import { computed, reactive } from 'vue'
import { createAiRegistryState, transitionAiRegistry } from '@/utils/aiRegistry.js'

export function useAiRegistry({ emitEvent } = {}) {
  const state = reactive(createAiRegistryState())
  const activeEngine = computed(() => state.engines.find((item) => item.id === state.active.engineId) || state.engines[0])
  const activeKnowledgeBases = computed(() => state.knowledgeBases.filter((item) => state.active.knowledgeBaseIds.includes(item.id)))

  function applyTransition(action) {
    const { state: nextState, outcome } = transitionAiRegistry(state, action, {
      id: `${Date.now()}-${state.audit.length}`,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false })
    })
    Object.assign(state, nextState)
    return outcome
  }

  function selectEngine(engineId) {
    const outcome = applyTransition({ type: 'select-engine', engineId })
    if (outcome.result === 'blocked') emitEvent?.('AI.CONFIG.BLOCKED', outcome.message)
    else if (outcome.changed) emitEvent?.('AI.ENGINE.ACTIVE', outcome.message)
    return outcome.result === 'applied'
  }

  function toggleKnowledgeBase(knowledgeBaseId) {
    const outcome = applyTransition({ type: 'toggle-knowledge', knowledgeBaseId })
    if (outcome.result === 'blocked') emitEvent?.('AI.KNOWLEDGE.BLOCKED', outcome.message)
    else emitEvent?.('AI.KNOWLEDGE.ACTIVE', outcome.message)
    return outcome.result === 'applied'
  }

  return { state, activeEngine, activeKnowledgeBases, selectEngine, toggleKnowledgeBase }
}
