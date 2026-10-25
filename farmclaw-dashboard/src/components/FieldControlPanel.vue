<script setup>
import { computed, ref, watch } from 'vue'
import TablerIcon from './TablerIcon.vue'
import { applyFieldControlAction, buildFieldControlModel } from '../utils/fieldControl.js'

const props = defineProps({
  field: { type: Object, required: true },
  readings: { type: Object, default: () => ({}) },
  machinery: { type: Array, default: () => [] },
  connection: { type: String, default: 'offline' }
})
const emit = defineEmits(['exit', 'locate', 'action'])
const controls = ref([])
const lastAction = ref('')
const model = computed(() => buildFieldControlModel(props.field, { readings: props.readings, machinery: props.machinery }))

watch(() => props.field.key, () => {
  controls.value = model.value.controls.map((item) => ({ ...item }))
  lastAction.value = ''
}, { immediate: true })

function triggerControl(control) {
  const result = applyFieldControlAction(controls.value, control.id)
  if (!result.outcome) return
  controls.value = result.controls
  lastAction.value = `${result.outcome.label} · ${result.outcome.active ? '本地模拟已执行' : '本地模拟已停止'}`
  emit('action', { ...result.outcome, fieldId: props.field.id, fieldName: props.field.name })
}
</script>

<template>
  <aside class="field-control-panel" role="tabpanel" aria-label="地块内部控制状态">
    <div class="field-control-backline">
      <button type="button" @click="emit('exit')"><TablerIcon name="arrow-left" :size="17" />返回全场</button>
      <span><i></i>FIELD CONTROL</span>
    </div>

    <header class="field-control-heading">
      <div class="workspace-panel-title">
        <TablerIcon name="seedling" :size="19" />
        <div><span>{{ model.id }} · 地块内控</span><h2>{{ model.name }}</h2><small>{{ model.crop }} · {{ model.stage }}</small></div>
      </div>
      <em :class="model.tone">{{ model.status }}</em>
    </header>

    <section class="field-control-summary" aria-label="地块作业摘要">
      <div><small>地块面积</small><strong>{{ model.area }}</strong></div>
      <div><small>作业分区</small><strong>{{ model.zones }}</strong></div>
      <div><small>生长进度</small><strong>{{ model.progress }}%</strong></div>
      <div><small>数据状态</small><strong>{{ model.healthyMetrics }}/4</strong></div>
    </section>

    <div class="field-progress"><span>当前生长阶段</span><i><b :style="{ width: `${model.progress}%` }"></b></i></div>

    <section class="field-twin-overview" aria-label="地块内部数字孪生">
      <header><div><span>INTERNAL DIGITAL TWIN</span><strong>地块内部孪生</strong></div><em><i></i>空间层已加载</em></header>
      <div class="field-twin-grid">
        <article><span class="field-twin-icon"><TablerIcon name="seedling" :size="17" /></span><div><strong>{{ model.fieldTwin.rowCount }}</strong><small>种植行</small></div></article>
        <article><span class="field-twin-icon"><TablerIcon name="antenna" :size="17" /></span><div><strong>{{ model.fieldTwin.onlineCount }}/{{ model.fieldTwin.sensorCount }}</strong><small>传感节点在线</small></div></article>
        <article><span class="field-twin-icon"><TablerIcon name="settings" :size="17" /></span><div><strong>{{ model.fieldTwin.valveCount }}</strong><small>灌溉阀门</small></div></article>
        <article><span class="field-twin-icon"><TablerIcon name="map" :size="17" /></span><div><strong>{{ model.fieldTwin.zoneCount }}</strong><small>作业分区</small></div></article>
      </div>
      <p>地图已展开种植行、灌溉管线、阀门、传感节点及分区状态。</p>
    </section>

    <section class="field-control-section" aria-label="环境监测">
      <header><div><span>ENVIRONMENT</span><strong>地块环境</strong></div><button type="button" @click="emit('locate', field)"><TablerIcon name="map-pin" :size="15" />重新定位</button></header>
      <dl class="field-metrics">
        <div v-for="metric in model.metrics" :key="metric.key" :class="metric.status"><dt>{{ metric.label }}</dt><dd>{{ metric.value }}<small>{{ metric.unit }}</small></dd><i></i></div>
      </dl>
    </section>

    <section class="field-control-section" aria-label="地块控制状态">
      <header><div><span>LOCAL DRY RUN</span><strong>控制状态</strong></div><em>{{ connection === 'online' ? '网关在线 · 未下发' : '网关离线 · 本地演示' }}</em></header>
      <div class="field-control-list">
        <article v-for="control in controls" :key="control.id" :class="[control.state, { unavailable: !control.available }]">
          <span class="field-control-icon"><TablerIcon :name="control.icon" :size="19" /></span>
          <div><strong>{{ control.label }}</strong><small>{{ control.detail }}</small></div>
          <span class="field-control-state"><i></i>{{ control.stateLabel }}</span>
          <button type="button" :disabled="!control.available" @click="triggerControl(control)">{{ control.available ? control.actionLabel : '不可用' }}</button>
        </article>
      </div>
      <p v-if="lastAction" class="field-action-result" role="status"><TablerIcon name="circle-check" :size="15" />{{ lastAction }}</p>
    </section>

    <section class="field-control-section" aria-label="可用作业设备">
      <header><div><span>AVAILABLE ASSETS</span><strong>地块作业资源</strong></div><em>{{ model.availableMachinery.length }} 台可调度</em></header>
      <div class="field-assets"><p v-for="machine in model.availableMachinery" :key="machine.id"><TablerIcon name="tractor" :size="17" /><span><strong>{{ machine.name }}</strong><small>{{ machine.id }} · {{ machine.statusLabel }}</small></span><em>{{ machine.energyLabel }}</em></p><p v-if="!model.availableMachinery.length" class="field-empty">当前没有可调度设备</p></div>
    </section>

    <p class="field-control-boundary">当前操作只更新本页面 Dry Run 状态，不代表现场设备已执行。</p>
  </aside>
</template>

<style scoped>
.field-control-panel { pointer-events:auto; }
.field-control-panel button { min-height:36px; display:inline-flex; align-items:center; justify-content:center; gap:5px; padding:0 9px; color:var(--ops-accent); border:1px solid var(--ops-line); border-radius:4px; background:transparent; cursor:pointer; }
.field-control-panel button:disabled { color:var(--ops-text-muted); background:var(--ops-surface-inset); cursor:not-allowed; }
.field-control-backline { display:flex; align-items:center; justify-content:space-between; margin:-8px -6px 16px; }
.field-control-backline button { border:0; }
.field-control-backline span { display:flex; align-items:center; gap:7px; color:var(--ops-accent); font:700 9px var(--ops-mono); }
.field-control-backline i { width:7px; height:7px; border:1px solid currentColor; transform:rotate(45deg); }
.field-control-heading em { color:var(--ops-accent); font-style:normal; }.field-control-heading em.warning { color:var(--ops-warning); }
.field-control-summary { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; margin-top:2px; border:1px solid var(--ops-line-soft); background:var(--ops-line-soft); }
.field-control-summary div { min-width:0; padding:11px 12px; background:var(--ops-surface-inset); }
.field-control-summary small,.field-control-summary strong { display:block; }.field-control-summary small { color:var(--ops-text-muted); }.field-control-summary strong { margin-top:5px; font:650 18px var(--ops-mono); }
.field-progress { margin:13px 0 20px; }.field-progress span { color:var(--ops-text-muted); }.field-progress i { display:block; height:4px; margin-top:7px; background:var(--ops-chart-grid); }.field-progress b { display:block; height:100%; background:var(--ops-accent); box-shadow:0 0 10px oklch(83% .12 154 / .28); }
.field-twin-overview { padding:14px 0 3px; border-top:1px solid var(--ops-line-soft); border-bottom:1px solid var(--ops-line-soft); }.field-twin-overview > header { display:flex; align-items:flex-end; justify-content:space-between; gap:10px; }.field-twin-overview header span { display:block; color:var(--ops-accent); font:700 9px var(--ops-mono); }.field-twin-overview header strong { display:block; margin-top:3px; font-size:14px; }.field-twin-overview header em { display:flex; align-items:center; gap:6px; color:var(--ops-success); font-size:10px; font-style:normal; }.field-twin-overview header em i { width:6px; height:6px; background:currentColor; transform:rotate(45deg); }
.field-twin-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; margin-top:12px; background:var(--ops-line-soft); }.field-twin-grid article { min-width:0; display:flex; align-items:center; gap:9px; padding:10px; background:var(--ops-surface-inset); }.field-twin-grid article > div { min-width:0; }.field-twin-grid strong,.field-twin-grid small { display:block; }.field-twin-grid strong { font:650 16px var(--ops-mono); }.field-twin-grid small { margin-top:2px; color:var(--ops-text-muted); }.field-twin-icon { width:30px; height:30px; display:grid; place-items:center; flex:0 0 auto; color:var(--ops-accent); border:1px solid var(--ops-line); background:var(--ops-surface-raised); }.field-twin-overview > p { margin:9px 0 7px; color:var(--ops-text-muted); line-height:1.5; }
.field-control-section { padding-top:18px; margin-top:18px; border-top:1px solid var(--ops-line-soft); }
.field-control-section > header { min-height:auto!important; display:flex!important; align-items:flex-end!important; justify-content:space-between!important; gap:10px!important; padding:0 0 10px!important; margin:0!important; border:0!important; }
.field-control-section header span { display:block; color:var(--ops-accent); font:700 9px var(--ops-mono); }.field-control-section header strong { display:block; margin-top:3px; font-size:14px; }.field-control-section header em { color:var(--ops-text-muted); font-size:10px; font-style:normal; text-align:right; }
.field-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 16px; margin:0; }
.field-metrics > div { position:relative; padding:10px 12px 10px 0; border-bottom:1px solid var(--ops-line-soft); }.field-metrics dt { color:var(--ops-text-muted); }.field-metrics dd { margin:4px 0 0; font:650 18px var(--ops-mono); }.field-metrics dd small { margin-left:3px; color:var(--ops-text-muted); font-size:9px; }.field-metrics i { position:absolute; top:13px; right:1px; width:6px; height:6px; background:var(--ops-success); transform:rotate(45deg); }.field-metrics .attention i { background:var(--ops-warning); }.field-metrics .pending i { background:var(--ops-text-muted); }
.field-control-list article { display:grid; grid-template-columns:36px minmax(0,1fr) auto; align-items:center; gap:9px; min-height:74px; padding:10px 0; border-bottom:1px solid var(--ops-line-soft); }.field-control-list article.unavailable { opacity:.55; }
.field-control-icon { width:34px; height:34px; display:grid; place-items:center; color:var(--ops-accent); border:1px solid var(--ops-line); background:var(--ops-surface-inset); }.field-control-list article > div { min-width:0; }.field-control-list article > div strong,.field-control-list article > div small { display:block; overflow-wrap:anywhere; }.field-control-list article > div small { margin-top:3px; color:var(--ops-text-muted); }
.field-control-state { display:flex; align-items:center; gap:6px; color:var(--ops-text-muted); font-size:10px; }.field-control-state i { width:6px; height:6px; background:var(--ops-text-muted); transform:rotate(45deg); }.field-control-list .running .field-control-state { color:var(--ops-success); }.field-control-list .running .field-control-state i { background:var(--ops-success); }.field-control-list .guarded .field-control-state { color:var(--ops-warning); }.field-control-list .guarded .field-control-state i { background:var(--ops-warning); }
.field-control-list article > button { grid-column:2/4; justify-self:start; min-width:92px; }.field-action-result { display:flex; align-items:center; gap:7px; margin:12px 0 0; color:var(--ops-success); }
.field-assets p { display:grid; grid-template-columns:24px minmax(0,1fr) auto; align-items:center; gap:8px; margin:0; padding:10px 0; border-bottom:1px solid var(--ops-line-soft); }.field-assets p > svg { color:var(--ops-accent); }.field-assets p span { min-width:0; }.field-assets p strong,.field-assets p small { display:block; }.field-assets p small { margin-top:2px; color:var(--ops-text-muted); }.field-assets p > em { color:var(--ops-accent); font:650 12px var(--ops-mono); font-style:normal; }.field-assets .field-empty { display:block; color:var(--ops-text-muted); }
.field-control-boundary { margin:20px 0 0; padding:10px 0 0; color:var(--ops-warning); border-top:1px solid var(--ops-line-soft); line-height:1.6; }
@media (max-width:600px) { .field-control-list article { grid-template-columns:36px minmax(0,1fr); }.field-control-state { grid-column:2; }.field-control-list article > button { grid-column:2; }.field-control-summary { grid-template-columns:repeat(4,minmax(100px,1fr)); overflow-x:auto; }.field-control-summary div { min-width:100px; } }
</style>
