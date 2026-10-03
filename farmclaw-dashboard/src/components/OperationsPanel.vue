<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { EQUIPMENT_STATUS_LABELS, RESOURCE_LABELS, filterOperationsEquipment } from '@/utils/operationsDashboard.js'
import { MACHINERY_STATUS_LABELS, filterMachinery } from '@/utils/machineryMonitor.js'
import { MACHINERY_ICON_IDS, equipmentIconKey, facilityIconDataUri } from '@/utils/facilityIcons.js'
import TablerIcon from '@/components/TablerIcon.vue'

const props = defineProps({
  model: { type: Object, required: true },
  selectedMachinery: { type: Object, default: null }
})
const emit = defineEmits(['action'])
const panel = ref(null)
const activeView = ref('resources')
const activePeriod = ref('day')
const activeStatus = ref('all')
const activeMachineryStatus = ref('all')

const period = computed(() => props.model.resources[activePeriod.value])
const equipment = computed(() => filterOperationsEquipment(props.model.equipment, { status: activeStatus.value }))
const machinery = computed(() => filterMachinery(props.model.machinery, { status: activeMachineryStatus.value }))
const resourceKeys = ['water', 'electricity', 'fertilizer', 'pesticide']
const resourceIcons = Object.freeze({ water: 'droplet', electricity: 'bolt', fertilizer: 'flask', pesticide: 'spray' })
const statusOptions = computed(() => [
  { id: 'all', label: '全部', count: props.model.equipment.total },
  ...Object.entries(EQUIPMENT_STATUS_LABELS).map(([id, label]) => ({ id, label, count: props.model.equipment.counts[id] || 0 }))
])
const machineryStatusOptions = computed(() => [
  { id: 'all', label: '全部', count: props.model.machinery.total },
  ...Object.entries(MACHINERY_STATUS_LABELS).map(([id, label]) => ({ id, label, count: props.model.machinery.counts[id] || 0 }))
])
const linkLabel = computed(() => props.model.liveLink.connection === 'online' ? '网关在线' : props.model.liveLink.connection === 'connecting' ? '正在连接' : '离线观测')

function setView(view) {
  activeView.value = view
  emit('action', { type: 'view', view })
}

function setStatus(status) {
  activeStatus.value = status
  emit('action', { type: 'equipment-filter', status })
}

function setMachineryStatus(status) {
  activeMachineryStatus.value = status
  emit('action', { type: 'machinery-filter', status })
}

function focusMachinery(machineId) {
  emit('action', { type: 'focus-machinery', machineryId: machineId })
}

watch(() => props.selectedMachinery?.id, async (machineId) => {
  if (!machineId) return
  activeView.value = 'machinery'
  await nextTick()
  const target = [...(panel.value?.querySelectorAll('[data-machinery-id]') || [])]
    .find((element) => element.dataset.machineryId === machineId)
  target?.scrollIntoView({ block: 'nearest' })
})

function chartHeight(resource, value) {
  const values = period.value.series.map((item) => Number(item[resource]) || 0)
  const targetPerPoint = (Number(period.value.summary[resource].target) || 0) / Math.max(period.value.series.length, 1)
  const max = Math.max(1, ...values, targetPerPoint)
  return `${Math.max(8, (value / max) * 100)}%`
}

function targetPosition(resource) {
  const values = period.value.series.map((item) => Number(item[resource]) || 0)
  const target = (Number(period.value.summary[resource].target) || 0) / Math.max(period.value.series.length, 1)
  const max = Math.max(1, ...values, target)
  return `${Math.min(100, (target / max) * 100)}%`
}

function peakPoint(resource) {
  const series = period.value.series
  if (!series.length) return null
  return series.reduce((current, item) => Number(item[resource]) > Number(current[resource]) ? item : current, series[0])
}

function peakSummary(resource) {
  const peak = peakPoint(resource)
  if (!peak) return '暂无序列数据'
  return `峰值 ${peak[resource]} ${period.value.units[resource]} · ${peak.label}`
}

function deltaLabel(metric) {
  const sign = metric.delta > 0 ? '+' : ''
  return `${sign}${metric.delta}`
}

function signalLabel(value) {
  const text = String(value || '')
  return text.length >= 16 ? text.slice(5, 16).replace('T', ' ') : '未记录'
}

function machineryEnergy(item) {
  return item.energyKind === 'battery' ? `电量 ${item.battery}%` : `油量 ${item.fuel}%`
}

function machineryMotion(item) {
  return item.status === 'running' ? `${item.speed} km/h` : item.statusLabel
}
</script>

<template>
  <aside ref="panel" class="operations-panel" aria-label="运营保障看板">
    <header>
      <div class="workspace-panel-title"><TablerIcon name="tractor" :size="19" aria-hidden="true" /><div><span>OPERATIONS / RESOURCE &amp; ASSET</span><h2>运营保障</h2></div></div>
      <em>只读看板</em>
    </header>

    <div class="provenance-strip">
      <span><i :class="model.liveLink.connection"></i>{{ linkLabel }} · {{ model.liveLink.nodes?.length || 0 }} 节点</span>
      <strong>DEMO BASELINE</strong>
    </div>

    <div class="operations-tabs" role="group" aria-label="运营看板类型">
      <button type="button" :aria-pressed="activeView === 'resources'" :class="{ active: activeView === 'resources' }" @click="setView('resources')">资源消耗</button>
      <button type="button" :aria-pressed="activeView === 'equipment'" :class="{ active: activeView === 'equipment' }" @click="setView('equipment')">设备运行</button>
      <button type="button" :aria-pressed="activeView === 'machinery'" :class="{ active: activeView === 'machinery' }" @click="setView('machinery')">农机监测</button>
    </div>

    <template v-if="activeView === 'resources'">
      <div class="period-switch" role="group" aria-label="资源统计周期">
        <button v-for="item in [{ id: 'day', label: '今日' }, { id: 'week', label: '本周' }, { id: 'month', label: '本月' }]" :key="item.id" type="button" :aria-pressed="activePeriod === item.id" :class="{ active: activePeriod === item.id }" @click="activePeriod = item.id">{{ item.label }}</button>
      </div>

      <section class="resource-ledger">
        <article v-for="resource in resourceKeys" :key="resource" :class="['resource-card', resource]">
          <div class="resource-heading">
            <span><TablerIcon :name="resourceIcons[resource]" :size="16" :stroke-width="1.6" /><strong>{{ RESOURCE_LABELS[resource] }}</strong><small>{{ period.units[resource] }}</small></span>
            <em :class="{ over: period.summary[resource].delta > 0 }">{{ deltaLabel(period.summary[resource]) }}</em>
          </div>
          <div class="resource-values"><strong>{{ period.summary[resource].current }}</strong><span><small>目标</small><b>{{ period.summary[resource].target }}</b></span></div>
          <div class="micro-chart" role="img" :aria-label="`${RESOURCE_LABELS[resource]}${period.label}消耗趋势，当前 ${period.summary[resource].current}${period.units[resource]}，目标 ${period.summary[resource].target}${period.units[resource]}，${peakSummary(resource)}`">
            <span class="target-line" :style="{ bottom: targetPosition(resource) }" aria-hidden="true"></span>
            <i v-for="point in period.series" :key="`${resource}-${point.index}`" :style="{ height: chartHeight(resource, point[resource]) }"></i>
          </div>
          <div class="chart-axis" aria-hidden="true"><span>{{ period.series[0]?.label }}</span><span>{{ period.series.at(-1)?.label }}</span></div>
          <div v-if="peakPoint(resource)" class="resource-peak"><span>峰值</span><strong>{{ peakPoint(resource)[resource] }} {{ period.units[resource] }}</strong><time>{{ peakPoint(resource).label }}</time></div>
        </article>
      </section>

      <section class="zone-section">
        <div class="section-heading"><strong>分区消耗</strong><small>{{ period.label }} · 演示基线</small></div>
        <div class="zone-table">
          <div class="zone-row heading"><span>区域</span><span>水 m³</span><span>电 kWh</span><span>肥液 L</span><span>农药 L</span></div>
          <div v-for="zone in period.zoneBreakdown" :key="zone.id" class="zone-row"><strong>{{ zone.name }}</strong><span>{{ zone.water.current }}</span><span>{{ zone.electricity.current }}</span><span>{{ zone.fertilizer.current }}</span><span>{{ zone.pesticide.current }}</span></div>
        </div>
      </section>
      <p class="data-note">未接入真实水表、电表、肥液与农药计量。当前数值仅用于看板结构和阈值演示。</p>
    </template>

    <template v-else-if="activeView === 'equipment'">
      <div class="status-filter" role="group" aria-label="设备状态筛选">
        <button v-for="status in statusOptions" :key="status.id" type="button" :aria-pressed="activeStatus === status.id" :class="[status.id, { active: activeStatus === status.id }]" @click="setStatus(status.id)"><span>{{ status.label }}</span><small>{{ status.count }}</small></button>
      </div>

      <section class="equipment-section">
        <div class="section-heading"><strong>设备目录</strong><small>{{ equipment.length }} / {{ model.equipment.total }} · 演示基线</small></div>
        <div class="equipment-list">
          <article v-for="item in equipment" :key="item.id" :class="['equipment-row', item.status]">
            <div class="equipment-title"><i></i><img class="equipment-icon" :src="facilityIconDataUri(equipmentIconKey(item.category, item.name))" alt="" aria-hidden="true" /><span><strong>{{ item.name }}</strong><small>{{ item.zone }} · {{ item.category }}</small></span><em>{{ item.statusLabel }}</em></div>
            <dl><div><dt>负载</dt><dd>{{ item.load }}%</dd></div><div><dt>累计运行</dt><dd>{{ item.runtime }} h</dd></div><div><dt>编号</dt><dd>{{ item.id }}</dd></div></dl>
            <div class="equipment-signal"><span>最近信号</span><time :datetime="item.lastSignal">{{ signalLabel(item.lastSignal) }}</time></div>
            <div class="load-track"><i :style="{ width: `${item.load}%` }"></i></div>
          </article>
        </div>
      </section>
      <p class="data-note">设备列表为静态演示目录，不代表 PLC 或现场设备的真实开停机状态。</p>
    </template>

    <template v-else>
      <section class="machinery-overview" aria-label="农机运行概览">
        <article><small>农机总数</small><strong>{{ model.machinery.total }}</strong><em>台</em></article>
        <article class="running"><small>正在作业</small><strong>{{ model.machinery.activeTasks }}</strong><em>项任务</em></article>
        <article :class="{ attention: model.machinery.warningCount }"><small>异常关注</small><strong>{{ model.machinery.warningCount }}</strong><em>台</em></article>
        <article><small>今日工时</small><strong>{{ model.machinery.runtimeToday }}</strong><em>h</em></article>
      </section>

      <div class="fleet-progress">
        <div><span>今日覆盖</span><strong>{{ model.machinery.coverageArea }} ha</strong></div>
        <div><span>平均能源余量</span><strong>{{ model.machinery.averageEnergy }}%</strong></div>
        <time :datetime="model.machinery.lastUpdatedAt">演示快照 {{ signalLabel(model.machinery.lastUpdatedAt) }}</time>
      </div>

      <div class="machinery-filter" role="group" aria-label="农机状态筛选">
        <button v-for="status in machineryStatusOptions" :key="status.id" type="button" :aria-pressed="activeMachineryStatus === status.id" :class="[status.id, { active: activeMachineryStatus === status.id }]" @click="setMachineryStatus(status.id)"><span>{{ status.label }}</span><small>{{ status.count }}</small></button>
      </div>

      <section class="machinery-section">
        <div class="section-heading"><strong>农机运行清单</strong><small>{{ machinery.length }} / {{ model.machinery.total }} · 点击联动地图</small></div>
        <div class="machinery-list">
          <button v-for="item in machinery" :key="item.id" type="button" :data-machinery-id="item.id" :class="['machinery-card', item.status, { selected: selectedMachinery?.id === item.id }]" :aria-pressed="selectedMachinery?.id === item.id" :aria-label="`${item.name}，${item.statusLabel}，${item.task}，定位到地图`" @click="focusMachinery(item.id)">
            <span class="machine-head">
              <img :src="facilityIconDataUri(MACHINERY_ICON_IDS[item.type] ? item.type : 'generic')" alt="" aria-hidden="true" />
              <span><strong>{{ item.name }}</strong><small>{{ item.twinId }} · {{ item.typeLabel }}</small></span>
              <span class="machine-state"><em>{{ item.statusLabel }}</em><b :class="item.freshness">{{ item.freshnessLabel }}遥测</b></span>
            </span>
            <span class="machine-task"><i></i><strong>{{ item.task }}</strong><small>{{ item.progress }}%</small></span>
            <span class="machine-progress" aria-hidden="true"><i :style="{ width: `${item.progress}%` }"></i></span>
            <span class="machine-metrics">
              <span><small>运转</small><strong>{{ machineryMotion(item) }}</strong></span>
              <span><small>动力余量</small><strong>{{ machineryEnergy(item) }}</strong></span>
              <span><small>今日工时</small><strong>{{ item.runtimeToday }} h</strong></span>
              <span><small>累计工时</small><strong>{{ item.engineHours }} h</strong></span>
              <span><small>作业模式</small><strong>{{ item.mode }}</strong></span>
              <span><small>维护计划</small><strong>{{ item.nextService }}</strong></span>
            </span>
            <span class="machine-foot"><span>{{ item.zone }} · {{ item.operator }}</span><time :datetime="item.lastSignal">信号 {{ signalLabel(item.lastSignal) }}</time></span>
            <span v-if="item.alert" class="machine-alert">{{ item.alert }}</span>
          </button>
        </div>
      </section>
      <p class="data-note">农机位置、运转参数和作业进度均为演示遥测，不代表真实车辆位置、远程控制或调度结果。</p>
    </template>
  </aside>
</template>

<style scoped>
.operations-panel .machine-head { grid-template-columns:44px minmax(0,1fr) auto; }
.operations-panel .machine-head img { width:44px; height:44px; object-fit:contain; }
.operations-panel .equipment-title { grid-template-columns:8px 38px minmax(0,1fr) auto; }
.operations-panel .equipment-icon { width:38px; height:38px; }
.operations-panel .machinery-card:hover,.operations-panel .machinery-card.selected { transform:none; }
.operations-panel { position:absolute; top:100px; left:18px; width:430px; max-height:calc(100vh - 230px); padding:16px; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; color:var(--ops-text); border:1px solid var(--ops-line); border-radius:var(--ops-radius-md); background:var(--ops-surface); box-shadow:var(--ops-shadow); pointer-events:auto; }
header { display:flex; align-items:end; justify-content:space-between; gap:12px; padding-bottom:12px; border-bottom:1px solid var(--ops-line-soft); } header span { color:var(--ops-accent); font:700 10px var(--ops-mono); letter-spacing:.14em; } h2 { margin-top:5px; font-size:20px; font-weight:650; } header em { padding:5px 8px; color:var(--ops-text-muted); border:1px solid var(--ops-line); border-radius:var(--ops-radius-sm); font-size:10px; font-style:normal; }
.provenance-strip { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:10px; color:var(--ops-text-muted); font-size:10px; }.provenance-strip span { display:flex; align-items:center; gap:6px; }.provenance-strip i { width:7px; height:7px; border-radius:50%; background:var(--ops-danger); }.provenance-strip i.online { background:var(--ops-success); }.provenance-strip i.connecting { background:var(--ops-warning); }.provenance-strip strong { color:var(--ops-warning); font:700 9px var(--ops-mono); letter-spacing:.08em; }
.operations-tabs,.period-switch,.status-filter,.machinery-filter { display:grid; gap:3px; margin-top:10px; padding:3px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.6); }.operations-tabs { grid-template-columns:repeat(3,1fr); }.period-switch { grid-template-columns:repeat(3,1fr); }.operations-tabs button,.period-switch button,.status-filter button,.machinery-filter button { min-height:40px; color:var(--ops-text-muted); border:0; border-radius:var(--ops-radius-sm); background:transparent; cursor:pointer; }.operations-tabs button:hover,.period-switch button:hover,.status-filter button:hover,.machinery-filter button:hover { color:var(--ops-text); background:var(--ops-surface-raised); }.operations-tabs button.active,.period-switch button.active { color:var(--ops-canvas); background:var(--ops-accent); font-weight:700; }
.resource-ledger { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; margin-top:10px; overflow:hidden; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:var(--ops-line-soft); }.resource-ledger article { min-width:0; padding:12px; background:oklch(16% .025 225/.72); }.resource-heading,.resource-heading > span,.resource-values { display:flex; align-items:center; }.resource-heading { justify-content:space-between; gap:8px; }.resource-heading > span { min-width:0; gap:6px; }.resource-heading .tabler-icon { flex:0 0 16px; color:var(--ops-info); }.resource-card.electricity .resource-heading .tabler-icon { color:var(--ops-warning); }.resource-card.fertilizer .resource-heading .tabler-icon { color:var(--ops-success); }.resource-card.pesticide .resource-heading .tabler-icon { color:#d98bff; }.resource-heading strong { overflow:hidden; font-size:12px; text-overflow:ellipsis; white-space:nowrap; }.resource-heading small { color:var(--ops-text-muted); font:9px var(--ops-mono); }.resource-heading em { flex:0 0 auto; color:var(--ops-success); font:700 10px var(--ops-mono); font-style:normal; }.resource-heading em.over { color:var(--ops-danger); }.resource-values { align-items:end; justify-content:space-between; gap:10px; margin-top:9px; }.resource-values > strong { font:700 24px/1 var(--ops-mono); }.resource-values > span { display:grid; justify-items:end; gap:2px; color:var(--ops-text-muted); }.resource-values span small { font-size:9px; }.resource-values span b { color:var(--ops-text-soft); font:600 11px var(--ops-mono); }
.micro-chart { position:relative; height:56px; display:flex; align-items:end; gap:2px; margin-top:10px; overflow:hidden; border-bottom:1px solid var(--ops-line-soft); }.micro-chart > i { z-index:1; min-width:2px; flex:1; max-width:7px; border-radius:1px 1px 0 0; background:var(--ops-info); opacity:.76; }.resource-card.electricity .micro-chart > i { background:var(--ops-warning); }.resource-card.fertilizer .micro-chart > i { background:var(--ops-success); }.resource-card.pesticide .micro-chart > i { background:#d98bff; }.target-line { position:absolute; z-index:2; left:0; right:0; height:1px; border-top:1px dashed var(--ops-warning); opacity:.72; }.chart-axis { display:flex; justify-content:space-between; margin-top:4px; color:var(--ops-text-muted); font:8px var(--ops-mono); }.resource-peak { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:6px; margin-top:8px; padding-top:7px; border-top:1px solid var(--ops-line-soft); }.resource-peak span,.resource-peak time { color:var(--ops-text-muted); font-size:9px; }.resource-peak strong { min-width:0; color:var(--ops-text-soft); font:600 10px var(--ops-mono); text-align:right; }.resource-peak time { font-family:var(--ops-mono); text-align:right; }
.section-heading { display:flex; align-items:center; justify-content:space-between; margin:12px 0 7px; }.section-heading strong { font-size:13px; }.section-heading small { color:var(--ops-text-muted); font-size:10px; }.zone-table { border-top:1px solid var(--ops-line-soft); }.zone-row { display:grid; grid-template-columns:1.2fr repeat(4,.65fr); gap:6px; padding:7px 4px; border-bottom:1px solid var(--ops-line-soft); font:9px var(--ops-mono); text-align:right; }.zone-row strong,.zone-row > span:first-child { overflow:hidden; text-align:left; text-overflow:ellipsis; white-space:nowrap; }.zone-row.heading { color:var(--ops-text-muted); font:8px var(--ops-font); }.zone-row strong { font:600 10px var(--ops-font); }
.status-filter { grid-template-columns:repeat(5,1fr); }.status-filter button { min-width:0; display:flex; align-items:center; justify-content:center; gap:4px; padding:0 3px; font-size:10px; }.status-filter button small { font:700 9px var(--ops-mono); }.status-filter button.active { color:var(--ops-text); border:1px solid var(--ops-line); background:var(--ops-surface-raised); }.status-filter button.warning.active { color:var(--ops-warning); }.status-filter button.offline.active { color:var(--ops-danger); }
.equipment-list { max-height:calc(100vh - 438px); overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; }.equipment-row { padding:10px 5px; border-bottom:1px solid var(--ops-line-soft); }.equipment-title { display:grid; grid-template-columns:8px 27px 1fr auto; align-items:center; gap:7px; }.equipment-title > i { width:8px; height:8px; border-radius:50%; background:var(--ops-success); }.equipment-icon { width:27px; height:27px; object-fit:contain; }.equipment-row.standby .equipment-title > i { background:var(--ops-text-muted); }.equipment-row.warning .equipment-title > i { background:var(--ops-warning); }.equipment-row.offline .equipment-title > i { background:var(--ops-danger); }.equipment-title span { min-width:0; }.equipment-title strong,.equipment-title small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.equipment-title strong { font-size:12px; }.equipment-title small { margin-top:3px; color:var(--ops-text-muted); font-size:10px; }.equipment-title em { color:var(--ops-text-muted); font-size:10px; font-style:normal; }.equipment-row.warning .equipment-title em { color:var(--ops-warning); }.equipment-row.offline .equipment-title em { color:var(--ops-danger); }.equipment-row dl { display:grid; grid-template-columns:.6fr .8fr 1.4fr; gap:8px; margin:8px 0 6px 42px; }.equipment-row dl div { min-width:0; }.equipment-row dt { color:var(--ops-text-muted); font-size:9px; }.equipment-row dd { margin-top:3px; overflow:hidden; font:10px var(--ops-mono); text-overflow:ellipsis; white-space:nowrap; }.equipment-signal { display:flex; justify-content:space-between; gap:8px; margin:0 0 6px 42px; color:var(--ops-text-muted); font-size:9px; }.equipment-signal time { color:var(--ops-text); font:10px var(--ops-mono); }.load-track { height:2px; margin-left:42px; overflow:hidden; background:var(--ops-line-soft); }.load-track i { display:block; height:100%; background:var(--ops-accent); }
.machinery-overview { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; margin-top:10px; overflow:hidden; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:var(--ops-line-soft); }.machinery-overview article { min-width:0; padding:9px 7px; background:var(--ops-surface-inset); }.machinery-overview small,.machinery-overview strong,.machinery-overview em { display:block; }.machinery-overview small { color:var(--ops-text-muted); font-size:9px; white-space:nowrap; }.machinery-overview strong { margin:5px 0 2px; font:700 19px/1 var(--ops-mono); }.machinery-overview em { color:var(--ops-text-muted); font-size:8px; font-style:normal; }.machinery-overview .running strong { color:var(--ops-accent); }.machinery-overview .attention strong { color:var(--ops-warning); }
.fleet-progress { display:grid; grid-template-columns:1fr 1fr; gap:1px; margin-top:7px; border:1px solid var(--ops-line-soft); background:var(--ops-line-soft); }.fleet-progress > div { display:flex; justify-content:space-between; gap:5px; padding:7px; background:oklch(16% .025 225/.72); }.fleet-progress span,.fleet-progress time { color:var(--ops-text-muted); font-size:9px; }.fleet-progress strong { color:var(--ops-text); font:700 10px var(--ops-mono); }.fleet-progress time { grid-column:1/-1; padding:5px 7px; text-align:right; background:oklch(16% .025 225/.72); }
.machinery-filter { grid-template-columns:repeat(6,1fr); }.machinery-filter button { min-width:0; display:flex; align-items:center; justify-content:center; gap:3px; padding:0 2px; font-size:9px; }.machinery-filter button small { font:700 8px var(--ops-mono); }.machinery-filter button.active { color:var(--ops-text); border:1px solid var(--ops-line); background:var(--ops-surface-raised); }.machinery-filter button.running.active { color:var(--ops-accent); }.machinery-filter button.charging.active { color:var(--ops-info); }.machinery-filter button.warning.active { color:var(--ops-warning); }.machinery-filter button.offline.active { color:var(--ops-danger); }
.machinery-list { max-height:calc(100vh - 570px); overflow-y:auto; display:grid; gap:6px; padding-right:2px; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; }.machinery-card { width:100%; padding:9px; color:var(--ops-text); text-align:left; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.62); cursor:pointer; transition:border-color var(--ops-ease),background var(--ops-ease),transform var(--ops-ease); }.machinery-card:hover,.machinery-card.selected { border-color:var(--ops-accent); background:var(--ops-surface-raised); transform:translateX(2px); }.machinery-card.selected { box-shadow:inset 3px 0 0 var(--ops-accent); }.machinery-card.standby.selected { border-color:var(--ops-neutral); box-shadow:inset 3px 0 0 var(--ops-neutral); }.machinery-card.charging.selected { border-color:var(--ops-info); box-shadow:inset 3px 0 0 var(--ops-info); }.machinery-card.warning.selected { border-color:var(--ops-warning); box-shadow:inset 3px 0 0 var(--ops-warning); }.machinery-card.offline.selected { border-color:var(--ops-danger); box-shadow:inset 3px 0 0 var(--ops-danger); }.machine-head { display:grid; grid-template-columns:31px 1fr auto; align-items:center; gap:8px; }.machine-head img { width:31px; height:31px; }.machine-head > span { min-width:0; }.machine-head strong,.machine-head small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.machine-head strong { font-size:12px; }.machine-head small { margin-top:2px; color:var(--ops-text-muted); font:8px var(--ops-mono); }.machine-state { display:grid; justify-items:end; gap:3px; }.machine-state em { color:var(--ops-accent); font-size:10px; font-style:normal; }.machine-state b { color:var(--ops-text-muted); font:700 8px var(--ops-mono); font-weight:600; }.machine-state b.live { color:var(--ops-success); }.machine-state b.stale { color:var(--ops-warning); }.machinery-card.standby .machine-state em { color:var(--ops-text-muted); }.machinery-card.charging .machine-state em { color:var(--ops-info); }.machinery-card.warning .machine-state em { color:var(--ops-warning); }.machinery-card.offline .machine-state em { color:var(--ops-danger); }
.machine-task { display:grid; grid-template-columns:6px 1fr auto; align-items:center; gap:6px; margin-top:8px; }.machine-task i { width:6px; height:6px; border-radius:50%; background:var(--ops-accent); }.machinery-card.warning .machine-task i { background:var(--ops-warning); }.machinery-card.offline .machine-task i { background:var(--ops-danger); }.machine-task strong { overflow:hidden; font-size:10px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }.machine-task small { color:var(--ops-text-muted); font:9px var(--ops-mono); }.machine-progress { display:block; height:3px; margin:6px 0; overflow:hidden; background:var(--ops-line-soft); }.machine-progress i { display:block; height:100%; background:linear-gradient(90deg,var(--ops-info),var(--ops-accent)); }.machinery-card.warning .machine-progress i { background:var(--ops-warning); }.machinery-card.offline .machine-progress i { background:var(--ops-danger); }
.machine-metrics { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:var(--ops-line-soft); }.machine-metrics > span { min-width:0; padding:5px; background:var(--ops-surface-inset); }.machine-metrics small,.machine-metrics strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.machine-metrics small { color:var(--ops-text-muted); font-size:8px; }.machine-metrics strong { margin-top:3px; font:700 9px var(--ops-mono); }.machine-foot { display:flex; justify-content:space-between; gap:8px; margin-top:6px; color:var(--ops-text-muted); font-size:8px; }.machine-foot time { flex:0 0 auto; font-family:var(--ops-mono); }.machine-alert { display:block; margin-top:6px; padding:5px 6px; color:var(--ops-warning); border-left:2px solid currentColor; background:oklch(80% .13 75/.07); font-size:9px; line-height:1.35; }
.data-note { margin-top:9px; padding-top:8px; color:var(--ops-text-muted); border-top:1px solid var(--ops-line-soft); font-size:10px; line-height:1.5; }
@media (max-width:600px) { .operations-panel { top:auto; bottom:126px; left:10px; right:10px; width:auto; height:32vh; max-height:32vh; padding:12px; overflow-y:auto; border-radius:8px; }.operations-panel::before { content:""; display:block; width:36px; height:3px; margin:-5px auto 7px; border-radius:3px; background:var(--ops-line); } header { padding-bottom:8px; } h2 { font-size:17px; }.operations-tabs button,.period-switch button,.status-filter button,.machinery-filter button { min-height:44px; }.resource-ledger { grid-template-columns:1fr; overflow:visible; }.resource-ledger article { width:100%; min-width:0; }.zone-section { max-height:none; }.equipment-list,.machinery-list { max-height:none; }.machinery-overview { grid-template-columns:repeat(4,minmax(86px,1fr)); overflow-x:auto; }.fleet-progress { grid-template-columns:1fr; }.fleet-progress time { grid-column:1; }.machinery-filter { grid-template-columns:repeat(3,1fr); }.machine-metrics { grid-template-columns:repeat(2,1fr); }.machine-foot { flex-direction:column; gap:3px; }.data-note { font-size:10px; } }
</style>
