<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import TablerIcon from '@/components/TablerIcon.vue'

const props = defineProps({ model: { type: Object, required: true } })
const emit = defineEmits(['filter'])
const activeType = ref('all')
const typeOptions = [
  { id: 'all', label: '全部预警' },
  { id: 'climate', label: '气候预警' },
  { id: 'pest', label: '虫害预警' }
]
const alerts = computed(() => activeType.value === 'all' ? props.model.alerts : props.model.alerts.filter((item) => item.type === activeType.value))

function syncFilter() {
  emit('filter', { type: activeType.value, activeField: props.model.activeField })
}

function setType(type) {
  activeType.value = type
  syncFilter()
}

onMounted(syncFilter)
watch(() => props.model.activeField, syncFilter)
</script>

<template>
  <aside class="alert-center-panel" aria-label="预警中心">
    <header>
      <div class="workspace-panel-title"><TablerIcon name="alert-triangle" :size="19" aria-hidden="true" /><div><span>ALERT CENTER / EARLY WARNING</span><h2>预警中心</h2></div></div>
      <em :class="{ danger: model.counts.warning > 0 }"><TablerIcon name="alert-triangle" :size="14" />{{ model.counts.warning }} 高风险</em>
    </header>

    <section class="alert-stats" aria-label="预警统计">
      <article><strong>{{ model.counts.total }}</strong><small>全部预警</small></article>
      <article><strong>{{ model.counts.climate }}</strong><small>气候预警</small></article>
      <article><strong>{{ model.counts.pest }}</strong><small>虫害预警</small></article>
    </section>

    <nav class="alert-tabs" aria-label="预警类型">
      <button v-for="option in typeOptions" :key="option.id" type="button" :class="{ active: activeType === option.id }" :aria-pressed="activeType === option.id" @click="setType(option.id)">{{ option.label }}</button>
    </nav>

    <div v-if="activeType === 'all'" class="risk-legend event-legend" aria-label="地图离散风险事件图例">
      <span class="climate"><i></i>气候事件</span>
      <span class="pest"><i></i>虫害事件</span>
      <small>圆点大小表示风险分数</small>
    </div>
    <div v-else class="risk-legend heat-legend" :aria-label="`${activeType === 'climate' ? '气候' : '虫害'}风险热力图例`">
      <span :class="activeType"><i></i>{{ activeType === 'climate' ? '气候风险' : '虫害风险' }}</span>
      <span class="risk-axis"><b>低</b><b>中</b><b>高</b></span>
      <small>风险分数 0–100</small>
    </div>

    <section class="alert-list" aria-live="polite">
      <article v-for="alert in alerts" :key="alert.id" :class="['alert-row', alert.severity]">
        <div class="alert-row-heading"><span><TablerIcon :name="alert.type === 'climate' ? 'wind' : 'seedling'" :size="13" />{{ alert.typeLabel }}</span><em>{{ alert.severityLabel }}</em></div>
        <div class="alert-title"><strong>{{ alert.title }}</strong><small>{{ alert.window }}</small></div>
        <dl>
          <div><dt>范围</dt><dd>{{ alert.scope }}</dd></div>
          <div><dt>置信度</dt><dd>{{ alert.confidence == null ? '--' : `${alert.confidence}%` }}</dd></div>
        </dl>
        <p>{{ alert.evidence }}</p>
        <small class="recommendation">建议：{{ alert.recommendation }}</small>
      </article>
      <p v-if="!alerts.length" class="empty">当前类型暂无预警</p>
    </section>

    <p class="data-note">演示预警 · 尚未接入实时气象预报与病虫害识别服务 · {{ model.source }}</p>
  </aside>
</template>

<style scoped>
.alert-center-panel { position:absolute; top:100px; left:18px; width:430px; max-height:calc(100vh - 230px); display:flex; flex-direction:column; padding:16px; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; color:var(--ops-text); border:1px solid var(--ops-line); border-radius:var(--ops-radius-md); background:var(--ops-surface); box-shadow:var(--ops-shadow); pointer-events:auto; }
 header { display:flex; align-items:end; justify-content:space-between; gap:12px; padding-bottom:12px; border-bottom:1px solid var(--ops-line-soft); } header span { color:var(--ops-accent); font:700 10px var(--ops-mono); letter-spacing:.14em; } h2 { margin:5px 0 0; font-size:20px; font-weight:650; } header em { display:inline-flex; align-items:center; gap:4px; padding:5px 9px; color:var(--ops-warning); border:1px solid oklch(80% .13 75/.36); border-radius:var(--ops-radius-sm); font-size:10px; font-style:normal; } header em.danger { color:var(--ops-danger); border-color:oklch(72% .19 18/.42); }
.alert-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; margin:11px 0; overflow:hidden; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:var(--ops-line-soft); }.alert-stats article { padding:9px 6px; color:var(--ops-text); text-align:center; background:var(--ops-surface-inset); }.alert-stats strong,.alert-stats small { display:block; }.alert-stats strong { font:700 19px var(--ops-mono); }.alert-stats small { margin-top:4px; color:var(--ops-text-muted); font-size:10px; }
.alert-tabs { display:grid; grid-template-columns:repeat(3,1fr); gap:3px; padding:3px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.6); }.alert-tabs button { min-height:40px; color:var(--ops-text-muted); border:0; border-radius:var(--ops-radius-sm); background:transparent; cursor:pointer; }.alert-tabs button:hover { color:var(--ops-text); background:var(--ops-surface-raised); }.alert-tabs button.active { color:var(--ops-canvas); background:var(--ops-accent); font-weight:700; }
.risk-legend { display:flex; align-items:center; gap:10px; margin-top:8px; color:var(--ops-text-muted); font-size:10px; }.risk-legend span { display:flex; align-items:center; gap:5px; }.risk-legend i { width:26px; height:5px; border-radius:3px; background:linear-gradient(90deg,var(--ops-info),var(--ops-accent),var(--ops-warning),var(--ops-danger)); }.risk-legend .pest i { background:linear-gradient(90deg,var(--ops-violet),var(--ops-warning),var(--ops-danger)); }.event-legend i { width:10px; height:10px; border:2px solid var(--ops-info); border-radius:50%; background:oklch(75% .13 235/.2); }.event-legend .pest i { border-color:var(--ops-warning); background:oklch(80% .13 75/.2); }.risk-legend small { margin-left:auto; color:var(--ops-text-soft); font-size:9px; }.risk-axis { min-width:82px; display:grid!important; grid-template-columns:repeat(3,1fr); padding-top:7px; border-top:4px solid var(--ops-warning); }.risk-axis b { font-weight:500; text-align:center; }.risk-axis b:first-child { text-align:left; }.risk-axis b:last-child { text-align:right; }
 .alert-list { max-height:calc(100vh - 438px); margin-top:9px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; }.alert-row { position:relative; margin-bottom:7px; padding:10px 10px 10px 15px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:var(--ops-surface-inset); }.alert-row::before { content:""; position:absolute; top:14px; left:6px; width:6px; height:6px; border:1.5px solid var(--ops-neutral); transform:rotate(45deg); }.alert-row.warning { border-color:oklch(72% .19 18/.46); background:oklch(32% .14 18/.1); }.alert-row.warning::before { border:0; background:var(--ops-danger); clip-path:polygon(50% 0,100% 100%,0 100%); transform:none; }.alert-row.attention { border-color:oklch(80% .13 75/.4); background:oklch(30% .06 75/.1); }.alert-row.attention::before { border:0; background:var(--ops-warning); clip-path:polygon(50% 0,100% 100%,0 100%); transform:none; }.alert-row.normal { border-color:oklch(80% .13 150/.3); background:oklch(28% .06 150/.08); }.alert-row.normal::before { border-color:var(--ops-success); border-radius:50%; background:var(--ops-success); transform:none; }.alert-row-heading,.alert-title { display:flex; align-items:center; justify-content:space-between; gap:8px; }.alert-row-heading span { display:flex; align-items:center; gap:6px; color:var(--ops-accent); font:700 9px var(--ops-mono); }.alert-row-heading i,.alert-row-heading .tabler-icon { width:13px; height:13px; }.alert-row-heading i { width:6px; height:6px; border-radius:50%; background:currentColor; }.alert-row-heading em { color:var(--ops-text-muted); font-size:9px; font-style:normal; }.warning .alert-row-heading em { color:var(--ops-danger); }.attention .alert-row-heading em { color:var(--ops-warning); }.normal .alert-row-heading em { color:var(--ops-success); }.alert-title { margin-top:7px; }.alert-title strong { font-size:13px; }.alert-title small { color:var(--ops-text-muted); font:9px var(--ops-mono); }.alert-row dl { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:8px 0 0; }.alert-row dl div { display:flex; justify-content:space-between; gap:6px; padding-top:6px; border-top:1px solid var(--ops-line-soft); }.alert-row dt { color:var(--ops-text-muted); font-size:9px; }.alert-row dd { font:10px var(--ops-mono); }.alert-row p { margin:7px 0 0; color:var(--ops-text-muted); font-size:10px; }.recommendation { display:block; margin-top:4px; color:var(--ops-text); font-size:10px; line-height:1.4; }.empty { padding:20px; color:var(--ops-text-muted); text-align:center; }
.alert-list { min-height:0; flex:1 1 auto; max-height:none; }
.data-note { margin-top:9px; padding-top:8px; color:var(--ops-warning); border-top:1px solid var(--ops-line-soft); font-size:9px; line-height:1.5; }
@media (max-width:600px) { .alert-center-panel { top:auto; bottom:126px; left:10px; right:10px; width:auto; height:32vh; max-height:32vh; padding:12px; overflow-y:auto; border-radius:8px; }.alert-center-panel::before { content:""; display:block; width:36px; height:3px; margin:-5px auto 7px; border-radius:3px; background:var(--ops-line); } header { padding-bottom:8px; } h2 { font-size:17px; }.alert-tabs button,.alert-stats article { min-height:44px; font-size:11px; }.alert-stats { margin:8px 0; }.risk-legend { gap:7px; }.risk-legend i { width:20px; }.risk-legend small { display:none; }.alert-list { max-height:none; }.data-note { font-size:10px; } }
</style>
