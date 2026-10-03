export const ENGINE_STATUS_LABELS = Object.freeze({
  local_ready: '本地就绪',
  not_configured: '未配置',
  checking: '检查中',
  error: '不可用'
})

export const KNOWLEDGE_STATUS_LABELS = Object.freeze({
  local_ready: '本地就绪',
  not_configured: '未配置',
  indexing: '索引未接入',
  ready: '已就绪',
  error: '不可用'
})

const AVAILABLE_ENGINE_STATUSES = new Set(['local_ready'])
const AVAILABLE_KNOWLEDGE_STATUSES = new Set(['local_ready', 'ready'])

export function createAiRegistryState() {
  return {
    revision: 1,
    source: 'local-config-preview',
    active: {
      engineId: 'rule-baseline-v1',
      knowledgeBaseIds: ['organic-rules-v1']
    },
    engines: [
      {
        id: 'rule-baseline-v1', name: '规则基线 v1', kind: 'rules', provider: 'Farmclaw 本地规则引擎',
        status: 'local_ready', source: 'builtin', enabled: true,
        capabilities: { chat: true, tools: true, structuredOutput: true },
        description: '当前实际运行的可解释规则评估器，不需要外部模型服务。'
      },
      {
        id: 'gateway-llm-demo', name: 'Gateway LLM 适配示例', kind: 'llm', provider: '服务端托管 Provider',
        status: 'not_configured', source: 'demo', enabled: false,
        capabilities: { chat: true, tools: true, structuredOutput: true },
        description: '预留服务端路由示例，当前项目未接入真实模型服务。'
      },
      {
        id: 'local-agri-demo', name: '本地农业模型示例', kind: 'llm', provider: '本地推理服务',
        status: 'not_configured', source: 'demo', enabled: false,
        capabilities: { chat: true, tools: false, structuredOutput: false },
        description: '预留本地推理示例，未配置模型权重或推理端点。'
      }
    ],
    knowledgeBases: [
      {
        id: 'organic-rules-v1', name: '有机农业规则包', kind: 'rule_pack', status: 'local_ready', source: 'builtin', enabled: true,
        scope: '全场', documentLabel: '内置规则', description: '阈值、风险分级和有机投入品约束。非向量知识库。'
      },
      {
        id: 'greenhouse-sop-demo', name: '温室作业 SOP 示例', kind: 'vector', status: 'not_configured', source: 'demo', enabled: false,
        scope: '温室区域', documentLabel: '未接入索引', description: '需要服务端文档接入、清洗、切片和向量索引。'
      },
      {
        id: 'security-protocol-demo', name: '安防巡检规程示例', kind: 'vector', status: 'not_configured', source: 'demo', enabled: false,
        scope: '安防区域', documentLabel: '未接入索引', description: '需要服务端权限隔离和检索服务，当前不能启用。'
      }
    ],
    audit: []
  }
}

export function engineStatusLabel(status) {
  return ENGINE_STATUS_LABELS[status] || status
}

export function knowledgeStatusLabel(status) {
  return KNOWLEDGE_STATUS_LABELS[status] || status
}

function cloneState(state) {
  return {
    ...state,
    active: { ...state.active, knowledgeBaseIds: [...state.active.knowledgeBaseIds] },
    engines: state.engines.map((item) => ({ ...item, capabilities: { ...item.capabilities } })),
    knowledgeBases: state.knowledgeBases.map((item) => ({ ...item })),
    audit: [...state.audit]
  }
}

function withAudit(state, action, targetId, result, message, auditMeta = {}) {
  const record = {
    id: auditMeta.id || `registry-${state.audit.length + 1}`,
    action,
    targetId,
    result,
    message,
    actor: auditMeta.actor || 'operator',
    revision: state.revision,
    time: auditMeta.time || ''
  }
  state.audit.unshift(record)
  return record
}

/**
 * 返回新的 registry 状态，不修改传入对象。
 * outcome.result 只会是 applied 或 blocked，changed 表示是否产生有效配置变更。
 */
export function transitionAiRegistry(currentState, action, auditMeta = {}) {
  const state = cloneState(currentState)
  const targetId = action?.engineId || action?.knowledgeBaseId || ''

  if (action?.type === 'select-engine') {
    const engine = state.engines.find((item) => item.id === action.engineId)
    if (!engine || !AVAILABLE_ENGINE_STATUSES.has(engine.status)) {
      const message = engine
        ? `${engine.name} 当前${engineStatusLabel(engine.status)}，保持现有引擎`
        : '未找到指定引擎，保持现有引擎'
      const audit = withAudit(state, 'ENGINE.SELECT', targetId, 'blocked', message, auditMeta)
      return { state, outcome: { result: 'blocked', changed: false, message, audit } }
    }

    if (state.active.engineId === engine.id) {
      const message = `${engine.name} 已是当前有效引擎，无需重复切换`
      const audit = withAudit(state, 'ENGINE.ACTIVATE', targetId, 'applied', message, auditMeta)
      return { state, outcome: { result: 'applied', changed: false, message, audit } }
    }

    state.active.engineId = engine.id
    state.engines.forEach((item) => { item.enabled = item.id === engine.id })
    state.revision += 1
    const message = `下一次评估使用 ${engine.name}`
    const audit = withAudit(state, 'ENGINE.ACTIVATE', targetId, 'applied', message, auditMeta)
    return { state, outcome: { result: 'applied', changed: true, message, audit } }
  }

  if (action?.type === 'toggle-knowledge') {
    const knowledgeBase = state.knowledgeBases.find((item) => item.id === action.knowledgeBaseId)
    if (!knowledgeBase || !AVAILABLE_KNOWLEDGE_STATUSES.has(knowledgeBase.status)) {
      const message = knowledgeBase
        ? `${knowledgeBase.name} 当前${knowledgeStatusLabel(knowledgeBase.status)}，不能启用`
        : '未找到指定知识来源，保持现有配置'
      const audit = withAudit(state, 'KNOWLEDGE.TOGGLE', targetId, 'blocked', message, auditMeta)
      return { state, outcome: { result: 'blocked', changed: false, message, audit } }
    }

    const activeIds = state.active.knowledgeBaseIds
    const index = activeIds.indexOf(knowledgeBase.id)
    if (index >= 0 && activeIds.length === 1) {
      const message = '至少保留一个有效知识来源'
      const audit = withAudit(state, 'KNOWLEDGE.TOGGLE', targetId, 'blocked', message, auditMeta)
      return { state, outcome: { result: 'blocked', changed: false, message, audit } }
    }

    if (index >= 0) activeIds.splice(index, 1)
    else activeIds.push(knowledgeBase.id)
    state.knowledgeBases.forEach((item) => { item.enabled = activeIds.includes(item.id) })
    state.revision += 1
    const enabled = activeIds.includes(knowledgeBase.id)
    const message = `${knowledgeBase.name} 已${enabled ? '启用' : '停用'}`
    const audit = withAudit(state, 'KNOWLEDGE.TOGGLE', targetId, 'applied', message, auditMeta)
    return { state, outcome: { result: 'applied', changed: true, enabled, message, audit } }
  }

  const message = '不支持的配置操作'
  const audit = withAudit(state, 'REGISTRY.UNKNOWN', targetId, 'blocked', message, auditMeta)
  return { state, outcome: { result: 'blocked', changed: false, message, audit } }
}
