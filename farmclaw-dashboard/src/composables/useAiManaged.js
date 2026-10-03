import { reactive } from 'vue'

const MODE_LABELS = {
  manual: '观察模式',
  copilot: '辅助托管',
  managed: '自动托管'
}

const RISK_ORDER = { high: 0, medium: 1, low: 2 }
const TERMINAL_STATUSES = new Set(['submitted', 'simulated', 'rejected', 'failed'])

function numeric(reading) {
  const value = Number(reading?.value)
  return Number.isFinite(value) ? value : null
}

function makeTask(ruleId, input) {
  const subjectId = input.targetId || input.fieldId || 'farm'
  return {
    id: `${ruleId}:${subjectId}`,
    ruleId,
    fieldId: input.fieldId || 'farm',
    title: input.title,
    reason: input.reason,
    evidence: input.evidence || [],
    proposedAction: input.proposedAction,
    actionKind: input.actionKind,
    targetId: input.targetId || null,
    risk: input.risk || 'low',
    confidence: input.confidence || 80,
    autoEligible: Boolean(input.autoEligible),
    approvalRequired: input.risk !== 'low' || Boolean(input.protectedAction),
    status: 'proposed',
    createdAt: new Date().toISOString(),
    result: null
  }
}

export function evaluateManagedTasks(snapshot, now = Date.now()) {
  const readings = snapshot.readings || {}
  const security = snapshot.security || { cameras: [], fences: [], alertCount: 0 }
  const fieldId = snapshot.activeField || 'greenhouse-1'
  const tasks = []
  const temperature = numeric(readings.temperature)
  const moisture = numeric(readings.soil_moisture)
  const humidity = numeric(readings.humidity)
  const light = numeric(readings.light)
  const ph = numeric(readings.ph)
  const lastUpdated = snapshot.lastUpdatedAt ? new Date(snapshot.lastUpdatedAt).getTime() : null
  const telemetryStale = !lastUpdated || !Number.isFinite(lastUpdated) || now - lastUpdated > 5 * 60 * 1000

  const missingMetrics = [
    ['温度', temperature],
    ['土壤水分', moisture],
    ['光照', light],
    ['pH', ph]
  ].filter(([, value]) => value == null).map(([label]) => label)

  if (telemetryStale || missingMetrics.length > 0) {
    tasks.push(makeTask('telemetry-refresh-v1', {
      fieldId,
      title: '刷新田块遥测',
      reason: telemetryStale ? '关键遥测缺失或超过 5 分钟未更新' : `关键指标缺失：${missingMetrics.join('、')}`,
      evidence: [`最近更新：${snapshot.lastUpdatedAt || '无'}`, `缺失指标：${missingMetrics.join('、') || '无'}`, `在线节点：${snapshot.nodeCount || 0}`],
      proposedAction: '请求温度、土壤水分、光照和 pH 最新读数',
      actionKind: 'request_telemetry',
      risk: 'low',
      confidence: 99,
      autoEligible: true
    }))
  }

  if (moisture != null && moisture < 30) {
    tasks.push(makeTask('soil-moisture-low-v1', {
      fieldId,
      title: '生成滴灌审批建议',
      reason: `土壤水分 ${moisture}% 低于 30% 阈值`,
      evidence: [`土壤水分：${moisture}%`, '建议时长：20–30 分钟', '需结合降雨预报复核'],
      proposedAction: '提交滴灌 20–30 分钟审批单，不直接开启阀门',
      actionKind: 'irrigation_plan',
      risk: 'medium',
      confidence: 92,
      protectedAction: true
    }))
  } else if (moisture != null && moisture > 55) {
    tasks.push(makeTask('soil-moisture-high-v1', {
      fieldId,
      title: '暂停灌溉并巡检积水',
      reason: `土壤水分 ${moisture}% 高于 55% 阈值`,
      evidence: [`土壤水分：${moisture}%`, '高湿可能提高根部病害风险'],
      proposedAction: '提交暂停灌溉与排水巡检建议',
      actionKind: 'irrigation_pause_plan',
      risk: 'medium',
      confidence: 90,
      protectedAction: true
    }))
  }

  if (temperature != null && temperature > 32) {
    tasks.push(makeTask('temperature-high-v1', {
      fieldId,
      title: '温室通风降温',
      reason: `空气温度 ${temperature}°C 高于 32°C 阈值`,
      evidence: [`温度：${temperature}°C`, `湿度：${humidity ?? '--'}%`],
      proposedAction: '提交侧窗开启 30% 与循环风机巡检建议',
      actionKind: 'ventilation_plan',
      risk: 'medium',
      confidence: 91,
      protectedAction: true
    }))
  } else if (temperature != null && temperature < 18) {
    tasks.push(makeTask('temperature-low-v1', {
      fieldId,
      title: '低温保护复核',
      reason: `空气温度 ${temperature}°C 低于 18°C 阈值`,
      evidence: [`温度：${temperature}°C`, '检查保温幕与夜间加温策略'],
      proposedAction: '创建保温设施人工复核任务',
      actionKind: 'climate_inspection',
      risk: 'low',
      confidence: 88,
      autoEligible: true
    }))
  }

  if (humidity != null && humidity > 82) {
    tasks.push(makeTask('humidity-high-v1', {
      fieldId,
      title: '高湿病害预防',
      reason: `空气湿度 ${humidity}% 高于 82% 阈值`,
      evidence: [`湿度：${humidity}%`, '建议复核叶面结露和通风'],
      proposedAction: '创建叶面结露巡检与通风审批建议',
      actionKind: 'disease_inspection',
      risk: 'medium',
      confidence: 87,
      protectedAction: true
    }))
  }

  if (light != null && light < 8000) {
    tasks.push(makeTask('light-low-v1', {
      fieldId,
      title: '补光策略复核',
      reason: `光照 ${light}lx 低于 8000lx 阈值`,
      evidence: [`光照：${light}lx`, '需结合当前作物阶段确认补光时长'],
      proposedAction: '生成补光时长建议，等待人工批准',
      actionKind: 'lighting_plan',
      risk: 'medium',
      confidence: 84,
      protectedAction: true
    }))
  }

  if (ph != null && (ph < 6 || ph > 7.2)) {
    tasks.push(makeTask('soil-ph-outlier-v1', {
      fieldId,
      title: '土壤酸碱度复测',
      reason: `pH ${ph} 超出 6.0–7.2 规则范围`,
      evidence: [`pH：${ph}`, '禁止 AI 自动调整投入品'],
      proposedAction: '创建人工复测和有机投入品合规检查',
      actionKind: 'soil_review',
      risk: 'high',
      confidence: 95,
      protectedAction: true
    }))
  }

  const alertFeature = [...(security.cameras || []), ...(security.fences || [])]
    .find((item) => item.status === 'alarm' || Number(item.incidents) > 0)
  if ((security.alertCount || 0) > 0) {
    tasks.push(makeTask('security-alert-review-v1', {
      title: '人工复核安防告警',
      reason: `当前存在 ${security.alertCount} 个未处理安防告警`,
      evidence: alertFeature ? [`首要对象：${alertFeature.name}`, `状态：${alertFeature.status}`] : ['安防中心存在待处理事件'],
      proposedAction: '聚焦告警对象并等待值守人员确认；AI 不自动消警或撤防',
      actionKind: 'security_review',
      targetId: alertFeature?.id,
      risk: 'high',
      confidence: 99,
      protectedAction: true
    }))
  }

  const abnormalCameras = (security.cameras || []).filter((item) => ['offline', 'maintenance'].includes(item.status))
  if (abnormalCameras.length) {
    tasks.push(makeTask('camera-health-review-v1', {
      title: '创建摄像头巡检工单',
      reason: `${abnormalCameras.length} 个摄像头离线或维护中`,
      evidence: abnormalCameras.slice(0, 3).map((item) => `${item.name}：${item.status}`),
      proposedAction: '创建本地巡检任务并聚焦首个异常点位',
      actionKind: 'camera_inspection',
      targetId: abnormalCameras[0].id,
      risk: 'low',
      confidence: 98,
      autoEligible: true
    }))
  }

  if ((snapshot.nodeCount || 0) === 0) {
    tasks.push(makeTask('node-health-check-v1', {
      title: '检查业务节点健康度',
      reason: '网关在线，但未发现 IoT、气象或 AI 业务节点',
      evidence: [`网关：${snapshot.connection || 'unknown'}`, '业务节点：0'],
      proposedAction: '提交节点健康检查请求，不执行设备动作',
      actionKind: 'node_check',
      risk: 'low',
      confidence: 100,
      autoEligible: true
    }))
  }

  if (!tasks.some((task) => task.risk === 'high') && !telemetryStale && temperature != null && moisture != null) {
    tasks.push(makeTask('routine-patrol-v1', {
      fieldId,
      title: '执行数字孪生例行巡检',
      reason: '关键环境指标未触发高风险规则',
      evidence: [`温度：${temperature}°C`, `土壤水分：${moisture}%`],
      proposedAction: '启动地图无人机模拟巡航并记录审计事件',
      actionKind: 'map_patrol',
      risk: 'low',
      confidence: 86,
      autoEligible: true
    }))
  }

  return tasks.sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || b.confidence - a.confidence)
}

export function useAiManaged({ execute, emitEvent } = {}) {
  const state = reactive({
    mode: 'copilot',
    status: 'monitoring',
    dryRun: true,
    emergencyStopped: false,
    scope: ['greenhouse-1'],
    revision: 1,
    trustScore: 72,
    lastRunAt: null,
    nextRunAt: null,
    tasks: [],
    audit: [],
    guardrails: [
      { id: 'high-risk-approval', label: '中高风险必须人工批准', locked: true },
      { id: 'security-manual', label: '禁止自动撤防和自动消警', locked: true },
      { id: 'organic-whitelist', label: '有机投入品白名单', locked: true },
      { id: 'stale-data-block', label: '数据过期阻断物理动作', locked: true },
      { id: 'dry-run', label: '真实设备控制保持 Dry Run', locked: true }
    ]
  })
  const submittedIds = new Set()
  let lastSnapshot = null
  let executionEpoch = 0

  function audit(action, message, actor = 'AI Manager') {
    state.audit.unshift({ id: `${Date.now()}-${Math.random()}`, action, message, actor, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }) })
    state.audit = state.audit.slice(0, 40)
    emitEvent?.(`AI.${action}`, message)
  }

  function calculateTrust(snapshot, tasks) {
    let score = 100
    if (snapshot.connection !== 'online') score -= 25
    if ((snapshot.nodeCount || 0) === 0) score -= 18
    if (!snapshot.lastUpdatedAt) score -= 15
    if (tasks.some((task) => task.ruleId === 'telemetry-refresh-v1')) score -= 10
    return Math.max(35, score)
  }

  async function submitTask(task, actor = 'operator') {
    if (!task || submittedIds.has(task.id)) return task
    if (state.emergencyStopped || state.status === 'paused') {
      task.status = 'blocked'
      task.result = '托管已暂停，任务未提交'
      audit('BLOCKED', `${task.title}：托管已暂停`, actor)
      return task
    }
    if (task.fieldId !== 'farm' && !state.scope.includes(task.fieldId)) {
      task.status = 'blocked'
      task.result = `目标 ${task.fieldId} 不在当前托管范围内，任务未提交`
      audit('BLOCKED', `${task.title}：目标超出托管范围`, actor)
      return task
    }
    if (task.approvalRequired && task.status !== 'approved') {
      task.status = 'awaiting_approval'
      return task
    }

    task.status = 'submitting'
    const taskEpoch = executionEpoch
    audit('SUBMITTING', `${task.title} 正在提交`, actor)
    try {
      const result = await execute?.(task)
      if (state.emergencyStopped || taskEpoch !== executionEpoch) {
        task.status = 'blocked'
        task.result = '托管已暂停，异步返回结果未采信；已发出的动作需人工复核'
        audit('BLOCKED', `${task.title}：异步返回晚于紧急停止`, actor)
        return task
      }
      task.status = result?.status || 'simulated'
      task.result = result?.message || '已完成本地 Dry Run'
      submittedIds.add(task.id)
      audit(task.status === 'submitted' ? 'SUBMITTED' : 'SIMULATED', `${task.title}：${task.result}`, actor)
    } catch (error) {
      if (state.emergencyStopped || taskEpoch !== executionEpoch) {
        task.status = 'blocked'
        task.result = '托管已暂停，异步异常未改变阻断状态；已发出的动作需人工复核'
        audit('BLOCKED', `${task.title}：异步异常晚于紧急停止`, actor)
        return task
      }
      task.status = 'failed'
      task.result = error?.message || '提交失败'
      audit('FAILED', `${task.title}：${task.result}`, actor)
    }
    return task
  }

  async function evaluate(snapshot) {
    lastSnapshot = snapshot
    if (state.emergencyStopped || state.status === 'paused') return state.tasks
    state.status = 'deciding'
    const inScope = state.scope.includes(snapshot.activeField)
    const generated = inScope
      ? evaluateManagedTasks(snapshot)
      : [makeTask('scope-mismatch-v1', {
          fieldId: snapshot.activeField,
          title: '阻断范围外田块托管',
          reason: `当前田块 ${snapshot.activeField} 不在托管范围 ${state.scope.join('、')} 内`,
          evidence: [`当前田块：${snapshot.activeField}`, `允许范围：${state.scope.join('、')}`],
          proposedAction: '由管理员复核并显式调整托管范围，不执行任何设备动作',
          actionKind: 'scope_review',
          risk: 'high',
          confidence: 100,
          protectedAction: true
        })]
    const previous = new Map(state.tasks.map((task) => [task.id, task]))
    const activeIds = new Set(generated.map((task) => task.id))
    for (const taskId of submittedIds) {
      if (!activeIds.has(taskId)) submittedIds.delete(taskId)
    }
    const activeConfiguration = snapshot.aiConfig || {
      engineId: 'rule-baseline-v1',
      knowledgeBaseIds: ['organic-rules-v1'],
      revision: 1
    }
    state.tasks = generated.map((task) => {
      const old = previous.get(task.id)
      const configuredTask = {
        ...task,
        createdAt: old?.createdAt || task.createdAt,
        engineId: old?.engineId || activeConfiguration.engineId,
        knowledgeBaseIds: old?.knowledgeBaseIds ? [...old.knowledgeBaseIds] : [...activeConfiguration.knowledgeBaseIds],
        configRevision: old?.configRevision || activeConfiguration.revision
      }
      if (old && TERMINAL_STATUSES.has(old.status)) {
        return { ...configuredTask, status: old.status, result: old.result }
      }
      if (state.mode === 'manual') configuredTask.status = 'observed'
      else if (configuredTask.approvalRequired) configuredTask.status = 'awaiting_approval'
      return configuredTask
    })
    state.trustScore = calculateTrust(snapshot, state.tasks)
    state.lastRunAt = new Date().toISOString()
    state.nextRunAt = new Date(Date.now() + 60_000).toISOString()
    state.status = state.tasks.some((task) => task.status === 'awaiting_approval') ? 'waiting_approval' : 'monitoring'
    state.revision += 1
    audit('EVALUATED', `完成 ${state.scope.join(', ')} 策略评估，生成 ${state.tasks.length} 项任务`)

    if (state.mode === 'managed') {
      for (const task of state.tasks.filter((item) => item.autoEligible && item.status === 'proposed')) {
        task.status = 'approved'
        await submitTask(task, 'AI Auto Manager')
      }
    }
    return state.tasks
  }

  async function setMode(mode) {
    if (!MODE_LABELS[mode]) return
    state.mode = mode
    state.revision += 1
    audit('MODE', `切换为${MODE_LABELS[mode]}`, 'operator')
    if (lastSnapshot) await evaluate(lastSnapshot)
  }

  async function approve(taskId) {
    const task = state.tasks.find((item) => item.id === taskId)
    if (!task || TERMINAL_STATUSES.has(task.status)) return
    task.status = 'approved'
    audit('APPROVED', `${task.title} 已由人工批准`, 'operator')
    await submitTask(task, 'operator')
  }

  function reject(taskId) {
    const task = state.tasks.find((item) => item.id === taskId)
    if (!task || TERMINAL_STATUSES.has(task.status)) return
    task.status = 'rejected'
    task.result = '值守人员拒绝该建议'
    audit('REJECTED', `${task.title} 已拒绝`, 'operator')
  }

  function emergencyStop() {
    executionEpoch += 1
    state.emergencyStopped = true
    state.status = 'paused'
    state.tasks.forEach((task) => {
      if (!TERMINAL_STATUSES.has(task.status)) task.status = 'blocked'
    })
    audit('EMERGENCY_STOP', '托管队列已紧急暂停；已完成的物理动作无法由此回滚', 'operator')
  }

  async function resume() {
    state.emergencyStopped = false
    state.status = 'monitoring'
    audit('RESUMED', 'AI 托管已恢复，等待重新评估', 'operator')
    if (lastSnapshot) await evaluate(lastSnapshot)
  }

  return { state, evaluate, setMode, approve, reject, emergencyStop, resume, submitTask }
}

export { MODE_LABELS }
