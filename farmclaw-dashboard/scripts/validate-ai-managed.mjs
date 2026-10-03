import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { evaluateManagedTasks, useAiManaged } from '../src/composables/useAiManaged.js'

const viewSource = await readFile(new URL('../src/views/index.vue', import.meta.url), 'utf8')
const panelSource = await readFile(new URL('../src/components/AiManagedPanel.vue', import.meta.url), 'utf8')
assert.equal(viewSource.includes("handleTopic('security')\n      const selected = freeMapAdapter.focusSecurityFeature(task.targetId)"), true, 'AI 安防复核必须同步 HUD 与地图专题')
for (const implementation of ['restoreApprovalFocus', 'cancelApproval', 'tabindex="-1"']) {
  assert.equal(panelSource.includes(implementation), true, `AI 二阶段审批缺少焦点回收：${implementation}`)
}

const currentTime = new Date().toISOString()
const reading = (value) => ({ value })

function snapshot(values = {}, extra = {}) {
  return {
    readings: {
      temperature: reading(values.temperature ?? 24),
      soil_moisture: reading(values.soil_moisture ?? 42),
      humidity: reading(values.humidity ?? 65),
      light: reading(values.light ?? 16000),
      ph: reading(values.ph ?? 6.6)
    },
    activeField: 'greenhouse-1',
    lastUpdatedAt: currentTime,
    nodeCount: 3,
    connection: 'online',
    security: { cameras: [], fences: [], alertCount: 0 },
    ...extra
  }
}

function hasRule(tasks, ruleId) {
  return tasks.some((task) => task.ruleId === ruleId)
}

assert.equal(hasRule(evaluateManagedTasks(snapshot({ soil_moisture: 29.9 })), 'soil-moisture-low-v1'), true)
assert.equal(hasRule(evaluateManagedTasks(snapshot({ soil_moisture: 30 })), 'soil-moisture-low-v1'), false)
assert.equal(hasRule(evaluateManagedTasks(snapshot({ soil_moisture: 55 })), 'soil-moisture-high-v1'), false)
assert.equal(hasRule(evaluateManagedTasks(snapshot({ soil_moisture: 55.1 })), 'soil-moisture-high-v1'), true)
assert.equal(hasRule(evaluateManagedTasks(snapshot({ temperature: 32.1 })), 'temperature-high-v1'), true)
assert.equal(hasRule(evaluateManagedTasks(snapshot({ temperature: 17.9 })), 'temperature-low-v1'), true)
const partialReadings = snapshot()
partialReadings.readings.ph = { value: '--' }
assert.equal(hasRule(evaluateManagedTasks(partialReadings), 'telemetry-refresh-v1'), true, '任一关键遥测缺失都应请求刷新')

const phTask = evaluateManagedTasks(snapshot({ ph: 7.3 })).find((task) => task.ruleId === 'soil-ph-outlier-v1')
assert.equal(phTask.risk, 'high')
assert.equal(phTask.autoEligible, false)
assert.equal(phTask.approvalRequired, true)

const securityTasks = evaluateManagedTasks(snapshot({}, {
  security: {
    alertCount: 1,
    fences: [{ id: 'fence-1', name: '东侧围栏', status: 'alarm', incidents: 1 }],
    cameras: []
  }
}))
const alertTask = securityTasks.find((task) => task.ruleId === 'security-alert-review-v1')
assert.equal(alertTask.risk, 'high')
assert.equal(alertTask.autoEligible, false)
assert.equal(alertTask.targetId, 'fence-1')

const executed = []
const manager = useAiManaged({ execute: async (task) => {
  executed.push(task.id)
  return { status: 'simulated', message: '测试 Dry Run' }
} })
await manager.evaluate(snapshot({ temperature: 17.9, ph: 7.3 }))
await manager.setMode('managed')
assert.equal(executed.some((id) => id.startsWith('temperature-low-v1')), true)
assert.equal(executed.some((id) => id.startsWith('soil-ph-outlier-v1')), false)
assert.equal(manager.state.tasks.find((task) => task.ruleId === 'soil-ph-outlier-v1').status, 'awaiting_approval')

const lowTask = manager.state.tasks.find((task) => task.ruleId === 'temperature-low-v1')
const beforeDuplicate = executed.length
const lowExecutionsBefore = executed.filter((id) => id.startsWith('temperature-low-v1')).length
await manager.submitTask(lowTask)
assert.equal(executed.length, beforeDuplicate, '相同任务不得重复提交')

await manager.evaluate(snapshot({ temperature: 24, ph: 6.6 }))
await manager.evaluate(snapshot({ temperature: 17.9, ph: 6.6 }))
assert.equal(executed.filter((id) => id.startsWith('temperature-low-v1')).length, lowExecutionsBefore + 1, '规则条件解除后再次触发应创建新的可执行周期')

await manager.evaluate(snapshot({ temperature: 24, ph: 7.3 }))
manager.emergencyStop()
const blockedTask = manager.state.tasks.find((task) => task.ruleId === 'soil-ph-outlier-v1')
await manager.submitTask(blockedTask)
assert.equal(blockedTask.status, 'blocked')
await manager.resume()
assert.equal(manager.state.emergencyStopped, false)

let finishAsyncTask
const asyncManager = useAiManaged({
  execute: () => new Promise((resolve) => { finishAsyncTask = resolve })
})
await asyncManager.evaluate(snapshot({ temperature: 17.9 }))
const pendingTask = asyncManager.state.tasks.find((task) => task.ruleId === 'temperature-low-v1')
const pendingSubmission = asyncManager.submitTask(pendingTask)
asyncManager.emergencyStop()
finishAsyncTask({ status: 'submitted', message: '延迟返回' })
await pendingSubmission
assert.equal(pendingTask.status, 'blocked', '紧急停止后不得采信在途异步任务返回')
assert.match(pendingTask.result, /未采信/)

const scopedManager = useAiManaged({ execute: async () => ({ status: 'submitted' }) })
const otherField = snapshot({}, { activeField: 'orchard-b' })
await scopedManager.evaluate(otherField)
const scopeTask = scopedManager.state.tasks.find((task) => task.ruleId === 'scope-mismatch-v1')
assert.equal(scopeTask.risk, 'high')
await scopedManager.approve(scopeTask.id)
assert.equal(scopeTask.status, 'blocked', '范围外任务即使被批准也不得提交')
assert.match(scopeTask.result, /不在当前托管范围/)

const provenanceManager = useAiManaged()
await provenanceManager.evaluate(snapshot({ temperature: 17.9 }, {
  aiConfig: { engineId: 'rule-baseline-v1', knowledgeBaseIds: ['organic-rules-v1'], revision: 7 }
}))
const provenanceTask = provenanceManager.state.tasks.find((task) => task.ruleId === 'temperature-low-v1')
assert.equal(provenanceTask.engineId, 'rule-baseline-v1')
assert.deepEqual(provenanceTask.knowledgeBaseIds, ['organic-rules-v1'])
assert.equal(provenanceTask.configRevision, 7)
await provenanceManager.evaluate(snapshot({ temperature: 17.9 }, {
  aiConfig: { engineId: 'future-engine', knowledgeBaseIds: ['future-kb'], revision: 8 }
}))
assert.equal(provenanceManager.state.tasks.find((task) => task.ruleId === 'temperature-low-v1').configRevision, 7, '既有任务不得被新配置覆盖来源')
await provenanceManager.evaluate(snapshot({ temperature: 24, humidity: 83 }, {
  aiConfig: { engineId: 'future-engine', knowledgeBaseIds: ['future-kb'], revision: 8 }
}))
const newConfigurationTask = provenanceManager.state.tasks.find((task) => task.ruleId === 'humidity-high-v1')
assert.equal(newConfigurationTask.engineId, 'future-engine')
assert.deepEqual(newConfigurationTask.knowledgeBaseIds, ['future-kb'])
assert.equal(newConfigurationTask.configRevision, 8)

console.log('AI 托管规则、模式、护栏、暂停与幂等校验通过')
