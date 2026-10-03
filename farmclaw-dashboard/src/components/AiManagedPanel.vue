<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { MODE_LABELS } from '@/composables/useAiManaged.js'
import AiConfigurationPanel from '@/components/AiConfigurationPanel.vue'
import TablerIcon from '@/components/TablerIcon.vue'

const props = defineProps({
  state: { type: Object, required: true },
  registry: { type: Object, required: true },
  focusTaskId: { type: String, default: '' }
})

const emit = defineEmits(['action'])
const activeTab = ref('queue')
const configurationOpen = ref(false)
const panelRoot = ref(null)
const approvalCandidateId = ref(null)
const approvalConfirmButton = ref(null)
const approvalTriggerButton = ref(null)
const approvalReturnTarget = ref(null)
watch(() => props.focusTaskId, async (id) => {
  if (!id) return
  activeTab.value = 'queue'
  configurationOpen.value = false
  await nextTick()
  const target = [...(panelRoot.value?.querySelectorAll('[data-task-id]') || [])].find(item => item.dataset.taskId === id)
  target?.scrollIntoView({ block: 'nearest' })
  target?.focus({ preventScroll: true })
}, { immediate: true })

const statusLabels = {
  monitoring: '持续观察',
  deciding: '正在评估',
  waiting_approval: '等待审批',
  paused: '紧急暂停'
}

const taskStatusLabels = {
  proposed: '建议',
  observed: '已观察',
  awaiting_approval: '待审批',
  approved: '已批准',
  submitting: '提交中',
  submitted: '已提交',
  simulated: '已模拟',
  rejected: '已拒绝',
  blocked: '已阻断',
  failed: '失败'
}

const pendingCount = computed(() => props.state.tasks.filter((task) => task.status === 'awaiting_approval').length)
const canDecide = (task) => ['proposed', 'awaiting_approval', 'observed', 'blocked'].includes(task.status) && !props.state.emergencyStopped

function act(type, payload = {}) {
  emit('action', { type, ...payload })
}

function setApprovalConfirmButton(element) {
  approvalConfirmButton.value = element
}

async function requestApproval(taskId, event) {
  approvalTriggerButton.value = event?.currentTarget || null
  approvalReturnTarget.value = event?.currentTarget?.closest('.task-card') || null
  approvalCandidateId.value = taskId
  await nextTick()
  approvalConfirmButton.value?.focus()
}

async function restoreApprovalFocus() {
  const returnTarget = approvalReturnTarget.value
  const triggerButton = approvalTriggerButton.value
  await nextTick()
  const restoredTrigger = returnTarget?.querySelector('.task-actions > button')
  if (restoredTrigger?.isConnected) restoredTrigger.focus()
  else if (returnTarget?.isConnected) returnTarget.focus()
  else if (triggerButton?.isConnected) triggerButton.focus()
  else if (panelRoot.value?.isConnected) panelRoot.value.focus()
  approvalReturnTarget.value = null
  approvalTriggerButton.value = null
}

async function cancelApproval() {
  approvalCandidateId.value = null
  await restoreApprovalFocus()
}

async function confirmApproval(taskId) {
  approvalCandidateId.value = null
  act('approve', { taskId })
  await restoreApprovalFocus()
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString('zh-CN', { hour12: false }) : '--:--:--'
}
</script>

<template>
  <aside ref="panelRoot" class="ai-managed-panel" tabindex="-1" aria-label="AI 托管中心">
    <header class="ai-header">
      <div class="workspace-panel-title">
        <TablerIcon name="settings" :size="19" aria-hidden="true" />
        <div>
        <span>AI MANAGED OPS</span>
        <h2>AI 托管中心</h2>
        <small class="engine-provenance">{{ registry.engines.find((item) => item.id === registry.active.engineId)?.name }} · {{ registry.active.knowledgeBaseIds.length }} 个知识来源</small>
        </div>
      </div>
      <div class="ai-header-actions">
        <div class="ai-health" aria-live="polite">
          <em :class="{ stopped: state.emergencyStopped }">{{ statusLabels[state.status] || state.status }}</em>
          <strong>{{ state.trustScore }}%<small>托管就绪度</small></strong>
        </div>
        <button :class="['settings-button', { active: configurationOpen }]" type="button" :aria-pressed="configurationOpen" aria-label="模型与知识库设置" title="模型与知识库设置" @click="configurationOpen = !configurationOpen">
          <TablerIcon name="settings" :size="16" />
          <span>设置</span>
        </button>
      </div>
    </header>

    <section v-if="configurationOpen" class="settings-view" aria-label="AI 设置视图">
      <div class="settings-toolbar">
        <button type="button" aria-label="返回 AI 托管" @click="configurationOpen = false">
          <TablerIcon name="arrow-left" :size="16" />
          返回托管
        </button>
        <span><strong>模型与知识库设置</strong><small>本地配置与接入边界</small></span>
      </div>
      <AiConfigurationPanel :registry="registry" @action="emit('action', $event)" />
    </section>

    <template v-else>
    <section class="mode-switch" aria-label="托管模式">
      <button
        v-for="(label, mode) in MODE_LABELS"
        :key="mode"
        :class="{ active: state.mode === mode }"
        :aria-pressed="state.mode === mode"
        type="button"
        @click="act('mode', { mode })"
      >
        {{ label.replace('模式', '') }}
      </button>
    </section>
    <p class="mode-explanation">
      {{ state.mode === 'manual' ? '只观察并解释状态，不提交任务。' : state.mode === 'copilot' ? '生成建议，由值守人员批准后提交。' : '仅自动处理低风险巡检，中高风险仍需人工批准。' }}
    </p>

    <section class="run-summary">
      <article><small>运行范围</small><strong>{{ state.scope.join('、') }}</strong></article>
      <article><small>最近评估</small><strong>{{ formatTime(state.lastRunAt) }}</strong></article>
      <article><small>待审批</small><strong>{{ pendingCount }}</strong></article>
    </section>

    <p class="dry-run-notice"><strong>DRY RUN</strong><span>演示护栏已开启，不会直接控制真实设备</span></p>

    <div class="managed-actions">
      <button type="button" @click="act('evaluate')">立即重新评估</button>
      <button v-if="!state.emergencyStopped" class="danger" type="button" @click="act('stop')">紧急停止托管</button>
      <button v-else class="resume" type="button" @click="act('resume')">恢复托管</button>
    </div>

    <nav class="ai-tabs" aria-label="托管详情">
      <button :class="{ active: activeTab === 'queue' }" :aria-pressed="activeTab === 'queue'" type="button" @click="activeTab = 'queue'">任务 {{ state.tasks.length }}</button>
      <button :class="{ active: activeTab === 'guardrails' }" :aria-pressed="activeTab === 'guardrails'" type="button" @click="activeTab = 'guardrails'">护栏</button>
      <button :class="{ active: activeTab === 'audit' }" :aria-pressed="activeTab === 'audit'" type="button" @click="activeTab = 'audit'">审计</button>
    </nav>

    <section v-if="activeTab === 'queue'" class="task-list">
      <article v-for="task in state.tasks" :key="task.id" :data-task-id="task.id" :class="['task-card', task.risk]" tabindex="-1" :aria-label="`${task.title}，${task.risk === 'high' ? '高风险' : task.risk === 'medium' ? '中风险' : '低风险'}`">
        <div class="task-topline">
          <span>{{ task.risk === 'high' ? '高风险' : task.risk === 'medium' ? '中风险' : '低风险' }}</span>
          <em>{{ taskStatusLabels[task.status] || task.status }}</em>
          <strong>{{ task.confidence }}% 置信</strong>
        </div>
        <h3>{{ task.title }}</h3>
        <small class="task-target">目标：{{ task.fieldId === 'farm' ? '全场' : task.fieldId }}</small>
        <small class="task-provenance">{{ task.engineId || 'rule-baseline-v1' }} · KB {{ task.knowledgeBaseIds?.length || 0 }} · REV {{ task.configRevision || 1 }}</small>
        <p>{{ task.reason }}</p>
        <section class="task-action-preview" aria-label="建议动作与执行边界">
          <span>建议动作</span>
          <strong>{{ task.proposedAction }}</strong>
          <small>对象 {{ task.fieldId === 'farm' ? '全场' : task.fieldId }} · {{ state.dryRun ? 'Dry Run 模拟，不直接控制设备' : '将提交至当前网关' }}</small>
        </section>
        <details>
          <summary>查看依据与建议动作</summary>
          <ul><li v-for="item in task.evidence" :key="item">{{ item }}</li></ul>
          <b>证据仅支持当前建议，批准前请复核对象和现场状态。</b>
        </details>
        <div v-if="task.result" class="task-result">{{ task.result }}</div>
        <div v-if="canDecide(task) && state.mode !== 'manual'" class="task-actions">
          <template v-if="approvalCandidateId !== task.id">
            <button type="button" @click="requestApproval(task.id, $event)">审查并批准</button>
            <button type="button" @click="act('reject', { taskId: task.id })">拒绝</button>
          </template>
          <div v-else class="approval-confirm" role="alert">
            <p><strong>确认提交此动作？</strong><span>{{ task.proposedAction }}</span></p>
            <button :ref="setApprovalConfirmButton" type="button" @click="confirmApproval(task.id)">{{ state.dryRun ? '确认模拟提交' : '确认提交网关' }}</button>
            <button type="button" @click="cancelApproval">取消</button>
          </div>
        </div>
      </article>
      <p v-if="!state.tasks.length" class="empty">暂无托管任务，点击“立即重新评估”生成建议。</p>
    </section>

    <section v-else-if="activeTab === 'guardrails'" class="guardrail-list">
      <article v-for="guardrail in state.guardrails" :key="guardrail.id">
        <TablerIcon name="circle-check" :size="17" /><span><strong>{{ guardrail.label }}</strong><small>系统级护栏 · 不可绕过</small></span><em>锁定</em>
      </article>
      <p>自动模式仅可提交低风险、可回退的模拟或巡检动作；真实设备控制仍保持 Dry Run。</p>
    </section>

    <section v-else class="audit-list">
      <article v-for="event in state.audit" :key="event.id">
        <time>{{ event.time }}</time><strong>{{ event.action }}</strong><p>{{ event.message }}</p><small>{{ event.actor }}</small>
      </article>
      <p v-if="!state.audit.length" class="empty">暂无审计记录</p>
    </section>
    </template>
  </aside>
</template>

<style scoped>
.ai-managed-panel { position:absolute; top:100px; left:18px; width:400px; max-height:calc(100vh - 230px); display:flex; flex-direction:column; padding:16px; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; color:var(--ops-text); border:1px solid var(--ops-line); border-radius:var(--ops-radius-md); background:var(--ops-surface); box-shadow:var(--ops-shadow); pointer-events:auto; }
.ai-managed-panel:focus-visible { outline:2px solid var(--ops-accent); outline-offset:2px; }
.ai-header { display:flex; align-items:end; justify-content:space-between; gap:12px; padding-bottom:12px; border-bottom:1px solid var(--ops-line-soft); }
.ai-header span { color:var(--ops-accent); font:700 10px var(--ops-mono); letter-spacing:.14em; }
h2 { margin:5px 0 0; font-size:20px; font-weight:650; }
.engine-provenance { display:block; max-width:230px; margin-top:4px; overflow:hidden; color:var(--ops-text-muted); font:9px var(--ops-mono); text-overflow:ellipsis; white-space:nowrap; }
.ai-header-actions { display:flex; align-items:center; gap:7px; }
.ai-health { display:flex; align-items:center; gap:10px; }.ai-health em { padding:5px 8px; color:var(--ops-accent); border:1px solid var(--ops-line); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.62); font-size:11px; font-style:normal; }.ai-health em.stopped { color:var(--ops-danger); border-color:var(--ops-danger); background:oklch(32% .14 18/.24); }.ai-health > strong { font:700 19px var(--ops-mono); font-variant-numeric:tabular-nums; }.ai-health small { display:block; margin-top:2px; color:var(--ops-text-muted); font:10px var(--ops-font); }
.settings-button { min-width:50px; min-height:36px; display:flex; align-items:center; justify-content:center; gap:4px; padding:5px 7px; color:var(--ops-text-muted); border-color:var(--ops-line); background:var(--ops-surface-raised); }.settings-button:hover,.settings-button.active { color:var(--ops-accent); border-color:var(--ops-accent); }.settings-button svg,.settings-button .tabler-icon { width:15px; height:15px; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }.settings-button span { font-size:10px; }
.mode-switch,.ai-tabs { display:grid; grid-template-columns:repeat(3,1fr); gap:3px; margin-top:11px; padding:3px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.6); }
button { min-height:36px; color:var(--ops-text-muted); border:1px solid transparent; border-radius:var(--ops-radius-sm); background:transparent; cursor:pointer; transition:background var(--ops-ease),color var(--ops-ease),border-color var(--ops-ease); } button:hover { color:var(--ops-text); background:var(--ops-surface-raised); }
.mode-switch button.active,.ai-tabs button.active { color:var(--ops-canvas); background:var(--ops-accent); font-weight:700; }.mode-explanation { margin:7px 2px 0; color:var(--ops-text-muted); font-size:11px; line-height:1.4; }
.run-summary { display:grid; grid-template-columns:1.2fr 1fr .7fr; gap:1px; margin-top:10px; overflow:hidden; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:var(--ops-line-soft); }.run-summary article { padding:8px 9px; background:oklch(16% .025 225/.72); }.run-summary small,.run-summary strong { display:block; }.run-summary small { color:var(--ops-text-muted); font-size:10px; }.run-summary strong { margin-top:4px; overflow:hidden; font:700 11px var(--ops-mono); text-overflow:ellipsis; white-space:nowrap; }
.dry-run-notice { display:flex; align-items:center; gap:8px; margin-top:8px; padding:7px 9px; color:var(--ops-text-muted); border:1px solid oklch(80% .13 75/.32); border-radius:var(--ops-radius-sm); background:oklch(30% .06 75/.14); font-size:10px; }.dry-run-notice strong { color:var(--ops-warning); font:700 9px var(--ops-mono); letter-spacing:.08em; }.dry-run-notice span { line-height:1.35; }
.settings-toolbar svg,.settings-toolbar .tabler-icon { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
.settings-view { margin-top:11px; }.settings-toolbar { min-height:44px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding-bottom:9px; border-bottom:1px solid var(--ops-line-soft); }.settings-toolbar button { display:flex; align-items:center; gap:6px; min-height:40px; padding:6px 9px; color:var(--ops-accent); border-color:var(--ops-line); background:var(--ops-surface-raised); }.settings-toolbar > span { min-width:0; text-align:right; }.settings-toolbar strong,.settings-toolbar small { display:block; }.settings-toolbar strong { font-size:13px; }.settings-toolbar small { margin-top:3px; color:var(--ops-text-muted); font-size:9px; }.settings-view :deep(.ai-configuration) { max-height:calc(100vh - 300px); }
.managed-actions { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:9px; }.managed-actions button { min-height:40px; border-color:var(--ops-line-soft); font-weight:650; }.managed-actions button:first-child { color:var(--ops-canvas); background:var(--ops-accent); }.managed-actions .danger { color:var(--ops-danger); border-color:oklch(72% .19 18/.5); background:oklch(32% .14 18/.16); }.managed-actions .resume { color:var(--ops-canvas); background:var(--ops-accent); }
.ai-tabs button { min-height:32px; font-size:11px; }.task-list,.guardrail-list,.audit-list { flex:1 1 auto; min-height:0; max-height:none; margin-top:9px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; }
.task-card { margin-bottom:7px; padding:11px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.62); }.task-card:hover { border-color:var(--ops-line); background:var(--ops-surface-raised); }.task-card:focus-visible { outline:2px solid var(--ops-accent); outline-offset:2px; }.task-card.medium { background:oklch(30% .06 75/.09); }.task-card.high { border-color:oklch(72% .19 18/.42); background:oklch(32% .14 18/.11); }
.task-topline { display:flex; align-items:center; gap:7px; }.task-topline span,.task-topline em { padding:3px 6px; border-radius:3px; font-size:10px; font-style:normal; }.task-topline span { color:var(--ops-canvas); background:var(--ops-success); }.medium .task-topline span { background:var(--ops-warning); }.high .task-topline span { color:var(--ops-text); background:var(--ops-danger); }.task-topline em { color:var(--ops-text); border:1px solid var(--ops-line-soft); }.task-topline strong { margin-left:auto; color:var(--ops-text-muted); font:10px var(--ops-mono); }
.task-card h3 { margin:8px 0 3px; font-size:14px; font-weight:650; }.task-target { display:block; margin-bottom:3px; color:var(--ops-warning); font:10px var(--ops-mono); }.task-provenance { display:block; margin-bottom:5px; color:var(--ops-text-muted); font:8px var(--ops-mono); }.task-card > p { margin:0; color:oklch(84% .02 195); font-size:12px; line-height:1.45; } details { margin-top:7px; color:var(--ops-text-muted); font-size:11px; } summary { min-height:28px; display:flex; align-items:center; color:var(--ops-accent); cursor:pointer; } ul { margin:5px 0; padding-left:17px; } details b { display:block; color:var(--ops-text); font-weight:400; line-height:1.45; }
.task-action-preview { margin-top:8px; padding:8px 9px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:var(--ops-surface-inset); }.task-action-preview span,.task-action-preview strong,.task-action-preview small { display:block; }.task-action-preview span { color:var(--ops-accent); font:700 9px var(--ops-mono); letter-spacing:.06em; }.task-action-preview strong { margin-top:5px; color:var(--ops-text); font-size:11px; line-height:1.4; }.task-action-preview small { margin-top:5px; color:var(--ops-warning); font-size:10px; line-height:1.35; }
.task-result { margin-top:7px; padding:7px 8px; color:var(--ops-accent); border:1px solid var(--ops-line-soft); border-radius:3px; background:oklch(82% .15 184/.06); font-size:11px; line-height:1.4; }.task-actions { display:flex; gap:7px; margin-top:8px; }.task-actions button { min-height:36px; padding:6px 10px; border-color:var(--ops-line-soft); font-size:11px; }.task-actions > button:first-child { color:var(--ops-canvas); background:var(--ops-accent); }.approval-confirm { width:100%; display:grid; grid-template-columns:1fr auto; gap:6px; padding:8px; border:1px solid oklch(80% .13 75/.35); border-radius:var(--ops-radius-sm); background:oklch(30% .06 75/.12); }.approval-confirm p { grid-column:1/3; margin:0; }.approval-confirm p strong,.approval-confirm p span { display:block; }.approval-confirm p strong { color:var(--ops-warning); font-size:11px; }.approval-confirm p span { margin-top:4px; color:var(--ops-text-soft); font-size:10px; line-height:1.4; }.approval-confirm button:first-of-type { color:var(--ops-canvas); background:var(--ops-warning); font-weight:700; }
.guardrail-list article { display:flex; align-items:center; gap:9px; padding:10px 4px; border-bottom:1px solid var(--ops-line-soft); }.guardrail-list article > i,.guardrail-list article > .tabler-icon { display:grid; place-items:center; width:20px; height:20px; padding:2px; color:var(--ops-canvas); border-radius:50%; background:var(--ops-success); }.guardrail-list span { flex:1; }.guardrail-list strong,.guardrail-list small { display:block; }.guardrail-list strong { font-size:12px; }.guardrail-list small { margin-top:3px; color:var(--ops-text-muted); font-size:10px; }.guardrail-list em { color:var(--ops-warning); font-size:10px; font-style:normal; }.guardrail-list > p { padding:9px; color:var(--ops-warning); background:oklch(30% .06 75/.12); font-size:11px; line-height:1.5; }
.audit-list article { display:grid; grid-template-columns:58px 78px 1fr; gap:5px 7px; padding:9px 2px; border-bottom:1px solid var(--ops-line-soft); font-size:10px; }.audit-list time { color:var(--ops-text-muted); font-family:var(--ops-mono); }.audit-list strong { color:var(--ops-accent); }.audit-list p { grid-column:1/4; margin:0; color:oklch(84% .02 195); font-size:11px; line-height:1.45; }.audit-list small { grid-column:3; color:var(--ops-text-muted); }.empty { padding:20px 8px; color:var(--ops-text-muted); text-align:center; font-size:11px; }
@media (max-width:600px) { .ai-managed-panel { top:auto; bottom:126px; left:10px; right:10px; width:auto; height:32vh; max-height:32vh; padding:12px; overflow-y:auto; border-radius:8px; }.ai-managed-panel::before { content:""; display:block; width:36px; height:3px; margin:-5px auto 7px; border-radius:3px; background:var(--ops-line); } .ai-header { padding-bottom:8px; gap:7px; } h2 { font-size:17px; }.engine-provenance { max-width:145px; }.ai-header-actions { gap:5px; }.ai-health { gap:5px; }.ai-health em { padding:5px 6px; font-size:10px; }.ai-health > strong { font-size:16px; }.settings-button { min-width:44px; min-height:44px; padding:0; }.settings-button span { display:none; }.settings-button svg { width:18px; height:18px; }.mode-switch { margin-top:8px; }.mode-switch button { min-height:44px; }.mode-explanation { display:none; }.run-summary { margin-top:7px; }.dry-run-notice { margin-top:6px; }.managed-actions { margin-top:6px; }.managed-actions button { min-height:44px; }.ai-tabs { margin-top:7px; }.ai-tabs button { min-height:44px; }.task-list,.guardrail-list,.audit-list { max-height:none; min-height:70px; }.task-actions button { min-height:44px; }.settings-toolbar button { min-height:44px; }.settings-view :deep(.ai-configuration) { max-height:none; } }
</style>
