import assert from 'node:assert/strict'
import { createAiRegistryState, transitionAiRegistry } from '../src/utils/aiRegistry.js'

function transition(state, action) {
  return transitionAiRegistry(state, action, { id: `test-${state.audit.length + 1}`, time: '14:30:00' })
}

function prohibitedFields(value, path = '') {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) => {
    const nextPath = path ? `${path}.${key}` : key
    const own = /^(secret|apiKey)$/i.test(key) ? [nextPath] : []
    return own.concat(prohibitedFields(child, nextPath))
  })
}

const initial = createAiRegistryState()
assert.equal(initial.active.engineId, 'rule-baseline-v1')
assert.deepEqual(initial.active.knowledgeBaseIds, ['organic-rules-v1'])
assert.deepEqual(prohibitedFields(initial), [])

// 未配置引擎必须阻断，且 active/revision 均不改变。
let result = transition(initial, { type: 'select-engine', engineId: 'gateway-llm-demo' })
assert.equal(result.outcome.result, 'blocked')
assert.equal(result.outcome.audit.result, 'blocked')
assert.deepEqual(result.state.active, initial.active)
assert.equal(result.state.revision, initial.revision)
assert.deepEqual(initial.audit, [], '状态转换不得修改输入对象')

// 当前有效引擎重复选择可成功收敛，但不能无意义增加 revision。
result = transition(result.state, { type: 'select-engine', engineId: 'rule-baseline-v1' })
assert.equal(result.outcome.result, 'applied')
assert.equal(result.outcome.changed, false)
assert.equal(result.state.revision, initial.revision)

// 未配置知识库必须阻断；唯一有效知识来源不得被移除。
const beforeUnavailableKb = result.state
result = transition(beforeUnavailableKb, { type: 'toggle-knowledge', knowledgeBaseId: 'greenhouse-sop-demo' })
assert.equal(result.outcome.result, 'blocked')
assert.deepEqual(result.state.active, beforeUnavailableKb.active)
assert.equal(result.state.revision, beforeUnavailableKb.revision)

const beforeLastSource = result.state
result = transition(beforeLastSource, { type: 'toggle-knowledge', knowledgeBaseId: 'organic-rules-v1' })
assert.equal(result.outcome.result, 'blocked')
assert.deepEqual(result.state.active.knowledgeBaseIds, ['organic-rules-v1'])
assert.equal(result.state.revision, beforeLastSource.revision)

// 模拟一个已完成索引的来源，验证 applied 转换和多来源下的安全移除。
const readyState = createAiRegistryState()
readyState.knowledgeBases.find((item) => item.id === 'greenhouse-sop-demo').status = 'ready'
result = transition(readyState, { type: 'toggle-knowledge', knowledgeBaseId: 'greenhouse-sop-demo' })
assert.equal(result.outcome.result, 'applied')
assert.equal(result.outcome.changed, true)
assert.equal(result.state.revision, readyState.revision + 1)
assert.equal(result.state.active.knowledgeBaseIds.length, 2)
assert.equal(result.state.audit[0].result, 'applied')

result = transition(result.state, { type: 'toggle-knowledge', knowledgeBaseId: 'organic-rules-v1' })
assert.equal(result.outcome.result, 'applied')
assert.deepEqual(result.state.active.knowledgeBaseIds, ['greenhouse-sop-demo'])
assert.ok(result.state.active.knowledgeBaseIds.length >= 1)

assert.ok(result.state.audit.every((item) => ['applied', 'blocked'].includes(item.result)))
assert.deepEqual(prohibitedFields(result.state), [])

console.log('AI registry validation passed: blocked transitions preserve active/revision; idempotent selection and knowledge-source guard verified')
