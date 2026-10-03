<script setup>
import { computed, ref } from 'vue'
import { engineStatusLabel, knowledgeStatusLabel } from '@/utils/aiRegistry.js'
import TablerIcon from '@/components/TablerIcon.vue'

const props = defineProps({ registry: { type: Object, required: true } })
const emit = defineEmits(['action'])
const activeSection = ref('models')

const activeEngine = computed(() => props.registry.engines.find((item) => item.id === props.registry.active.engineId))
const activeKnowledgeCount = computed(() => props.registry.active.knowledgeBaseIds.length)
const latestAudit = computed(() => props.registry.audit[0] || null)

function act(type, payload = {}) {
  emit('action', { type, ...payload })
}
</script>

<template>
  <section class="ai-configuration" aria-label="模型与知识库管理">
    <div class="configuration-summary">
      <span><small>当前执行引擎</small><strong>{{ activeEngine?.name }}</strong></span>
      <span><small>知识来源</small><strong>{{ activeKnowledgeCount }} 个已启用</strong></span>
      <em>REV {{ registry.revision }}</em>
    </div>

    <div class="configuration-tabs" role="group" aria-label="AI 配置类型">
      <button type="button" :class="{ active: activeSection === 'models' }" :aria-pressed="activeSection === 'models'" @click="activeSection = 'models'">模型</button>
      <button type="button" :class="{ active: activeSection === 'knowledge' }" :aria-pressed="activeSection === 'knowledge'" @click="activeSection = 'knowledge'">知识库</button>
    </div>

    <p class="configuration-boundary"><strong>LOCAL CONFIG PREVIEW</strong><span>未连接推理 Provider 或向量服务，不在浏览器保存密钥</span></p>

    <div v-if="latestAudit" :class="['configuration-feedback', latestAudit.result]" aria-live="polite">
      <strong>{{ latestAudit.result === 'blocked' ? '配置未应用' : '配置已更新' }}</strong>
      <span>{{ latestAudit.message }}</span>
    </div>

    <div v-if="activeSection === 'models'" class="registry-list" role="radiogroup" aria-label="执行模型">
      <article v-for="engine in registry.engines" :key="engine.id" :class="['registry-row', engine.status, { selected: registry.active.engineId === engine.id }]">
        <button type="button" role="radio" :aria-checked="registry.active.engineId === engine.id" @click="act('select-engine', { engineId: engine.id })">
          <span class="registry-title"><i></i><strong>{{ engine.name }}</strong><em>{{ engineStatusLabel(engine.status) }}</em></span>
          <small>{{ engine.provider }}</small>
          <p>{{ engine.description }}</p>
          <span class="capability-line">
            <b :class="{ unavailable: !engine.capabilities.tools }">工具调用</b>
            <b :class="{ unavailable: !engine.capabilities.structuredOutput }">结构化输出</b>
            <b>{{ engine.kind === 'rules' ? '规则引擎' : '语言模型' }}</b>
          </span>
        </button>
      </article>
      <button class="disabled-action" type="button" disabled title="需要服务端模型路由和密钥管理"><TablerIcon name="plus" :size="14" />添加服务端模型</button>
    </div>

    <div v-else class="registry-list" aria-label="知识库来源">
      <article v-for="knowledgeBase in registry.knowledgeBases" :key="knowledgeBase.id" :class="['registry-row', knowledgeBase.status, { selected: registry.active.knowledgeBaseIds.includes(knowledgeBase.id) }]">
        <div class="registry-title"><i></i><strong>{{ knowledgeBase.name }}</strong><em>{{ knowledgeStatusLabel(knowledgeBase.status) }}</em></div>
        <small>{{ knowledgeBase.scope }} · {{ knowledgeBase.documentLabel }}</small>
        <p>{{ knowledgeBase.description }}</p>
        <button class="knowledge-toggle" type="button" :aria-pressed="registry.active.knowledgeBaseIds.includes(knowledgeBase.id)" @click="act('toggle-knowledge', { knowledgeBaseId: knowledgeBase.id })">
          {{ registry.active.knowledgeBaseIds.includes(knowledgeBase.id) ? '已启用' : knowledgeBase.status === 'local_ready' ? '启用' : '尝试启用' }}
        </button>
      </article>
      <button class="disabled-action" type="button" disabled title="需要服务端文档接入与向量索引服务"><TablerIcon name="plus" :size="14" />新增知识库</button>
    </div>

    <p class="secret-note">API Key、模型端点和知识原文必须由服务端密钥与权限系统管理，不能进入 VITE_*、浏览器存储或审计日志。</p>
  </section>
</template>

<style scoped>
.ai-configuration { max-height:calc(100vh - 540px); min-height:105px; margin-top:9px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; }
.configuration-summary { display:grid; grid-template-columns:1.2fr 1fr auto; gap:1px; overflow:hidden; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:var(--ops-line-soft); }.configuration-summary > span,.configuration-summary > em { padding:8px 9px; background:oklch(16% .025 225/.72); }.configuration-summary small,.configuration-summary strong { display:block; }.configuration-summary small { color:var(--ops-text-muted); font-size:9px; }.configuration-summary strong { margin-top:4px; overflow:hidden; font:700 10px var(--ops-mono); text-overflow:ellipsis; white-space:nowrap; }.configuration-summary em { display:grid; place-items:center; color:var(--ops-warning); font:700 9px var(--ops-mono); font-style:normal; }
.configuration-tabs { display:grid; grid-template-columns:repeat(2,1fr); gap:3px; margin-top:8px; padding:3px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.6); }.configuration-tabs button { min-height:36px; color:var(--ops-text-muted); border:0; border-radius:var(--ops-radius-sm); background:transparent; cursor:pointer; }.configuration-tabs button.active { color:var(--ops-canvas); background:var(--ops-accent); font-weight:700; }
.configuration-boundary { display:flex; align-items:center; gap:7px; margin:7px 0; padding:7px 8px; color:var(--ops-text-muted); border:1px solid oklch(80% .13 75/.28); border-radius:var(--ops-radius-sm); background:oklch(30% .06 75/.11); font-size:9px; line-height:1.35; }.configuration-boundary strong { flex:0 0 auto; color:var(--ops-warning); font:700 8px var(--ops-mono); letter-spacing:.06em; }
.configuration-feedback { display:flex; gap:7px; margin-bottom:7px; padding:7px 8px; color:var(--ops-text-muted); border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:var(--ops-surface-raised); font-size:10px; line-height:1.4; }.configuration-feedback strong { flex:0 0 auto; color:var(--ops-accent); }.configuration-feedback.blocked strong { color:var(--ops-warning); }
.registry-list { display:grid; gap:6px; }.registry-row { position:relative; padding:9px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.62); }.registry-row.selected { border-color:var(--ops-line); background:var(--ops-surface-raised); }.registry-row > button[role="radio"] { width:100%; padding:0; color:inherit; border:0; background:transparent; text-align:left; cursor:pointer; }.registry-title { display:grid; grid-template-columns:7px 1fr auto; align-items:center; gap:7px; }.registry-title i { width:7px; height:7px; border-radius:50%; background:var(--ops-text-muted); }.registry-row.local_ready .registry-title i { background:var(--ops-success); }.registry-row.selected .registry-title i { background:var(--ops-accent); }.registry-title strong { min-width:0; overflow:hidden; font-size:12px; text-overflow:ellipsis; white-space:nowrap; }.registry-title em { padding:2px 5px; color:var(--ops-text-muted); border:1px solid var(--ops-line-soft); border-radius:3px; font-size:9px; font-style:normal; }.registry-row.local_ready .registry-title em { color:var(--ops-success); }.registry-row > small,.registry-row button > small { display:block; margin:5px 0 0 14px; color:var(--ops-warning); font:9px var(--ops-mono); }.registry-row p { margin:6px 0 0 14px; color:var(--ops-text-muted); font-size:10px; line-height:1.4; }.capability-line { display:flex; gap:5px; margin:7px 0 0 14px; }.capability-line b { padding:2px 5px; color:var(--ops-text-muted); border:1px solid var(--ops-line-soft); border-radius:3px; font-size:8px; font-weight:500; }.capability-line b.unavailable { text-decoration:line-through; opacity:.55; }.knowledge-toggle { min-height:30px; margin:8px 0 0 14px; padding:4px 9px; color:var(--ops-accent); border:1px solid var(--ops-line); border-radius:var(--ops-radius-sm); background:transparent; cursor:pointer; }.knowledge-toggle[aria-pressed="true"] { color:var(--ops-canvas); background:var(--ops-accent); font-weight:700; }.disabled-action { min-height:36px; display:inline-flex; align-items:center; justify-content:center; gap:5px; color:var(--ops-text-muted); border:1px dashed var(--ops-line); border-radius:var(--ops-radius-sm); background:transparent; opacity:.55; cursor:not-allowed; }.disabled-action .tabler-icon { width:14px; height:14px; }.secret-note { margin-top:8px; padding-top:8px; color:var(--ops-text-muted); border-top:1px solid var(--ops-line-soft); font-size:9px; line-height:1.45; }
@media (max-width:600px) { .ai-configuration { max-height:calc(55vh - 322px); min-height:70px; }.configuration-tabs button { min-height:44px; }.configuration-boundary { align-items:flex-start; }.configuration-summary { grid-template-columns:1fr 1fr; }.configuration-summary > em { grid-column:1/3; padding:4px; }.registry-row > button[role="radio"],.knowledge-toggle,.disabled-action { min-height:44px; }.knowledge-toggle { margin-top:6px; }.capability-line { flex-wrap:wrap; } }
</style>
