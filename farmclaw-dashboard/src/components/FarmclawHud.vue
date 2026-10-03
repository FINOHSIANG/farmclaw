<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import SecurityPanel from '@/components/SecurityPanel.vue'
import AiManagedPanel from '@/components/AiManagedPanel.vue'
import ValueForecastPanel from '@/components/ValueForecastPanel.vue'
import OperationsPanel from '@/components/OperationsPanel.vue'
import AlertCenterPanel from '@/components/AlertCenterPanel.vue'
import SignalGauge from '@/components/visualization/SignalGauge.vue'
import TablerIcon from '@/components/TablerIcon.vue'
import WorkspaceSearch from './WorkspaceSearch.vue'
import WorkspaceInbox from './WorkspaceInbox.vue'
import WorkspaceObjectDetail from './WorkspaceObjectDetail.vue'
import { FACILITY_TYPE_LABELS, MACHINERY_ICON_IDS, equipmentIconKey, facilityIconDataUri } from '@/utils/facilityIcons.js'

const props = defineProps({
  state: { type: Object, required: true },
  mapStatus: { type: String, required: true },
  topic: { type: String, default: 'product' },
  mapError: { type: String, default: '' },
  mapProvider: { type: String, default: 'OpenFreeMap · MapLibre' },
  mapView: { type: String, default: '3d' },
  securityState: { type: Object, default: () => ({ fences: [], cameras: [] }) },
  selectedSecurityFeature: { type: Object, default: null },
  selectedMachinery: { type: Object, default: null },
  aiState: { type: Object, required: true },
  aiRegistry: { type: Object, required: true },
  valueForecast: { type: Object, default: null },
  operationsDashboard: { type: Object, required: true },
  alertCenter: { type: Object, required: true },
  objects: { type: Array, default: () => [] },
  selectedObject: { type: Object, default: null },
  attentionItems: { type: Array, default: () => [] },
  objectHistory: { type: Array, default: () => [] },
  focusTaskId: { type: String, default: '' }
})

const emit = defineEmits(['command', 'topic', 'map-action', 'security-action', 'ai-action', 'value-filter', 'operations-action', 'alert-filter', 'fullscreen', 'fullscreen-error', 'workspace-layout', 'object-open', 'object-close', 'object-locate', 'object-acknowledge', 'inbox-open'])
const command = ref('')
const activeTopic = ref('product')
const activeActions = ref(new Set())
const eventsCollapsed = ref(false)
const inboxOpen = ref(false)
const mobilePanelExpanded = ref(false)
const inspectorVisible = ref(true)
const legendExpanded = ref(false)
const activeAgentId = ref('agri-advisor')
const attachments = ref([])
const fileError = ref('')
const fileInput = ref(null)
const isFullscreen = ref(false)
const presentationMode = ref(false)
const brandLogoUrl = `${import.meta.env.BASE_URL}static/brand/sishi-seasons-logo-v2.png`
const displayClock = ref(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
const fullscreenSupported = typeof document !== 'undefined' && Boolean(document.documentElement?.requestFullscreen)
const displayClockTimer = typeof window !== 'undefined'
  ? window.setInterval(() => { displayClock.value = new Date().toLocaleTimeString('zh-CN', { hour12: false }) }, 1000)
  : null
const readings = computed(() => Object.entries(props.state.readings))
const READING_RANGES = Object.freeze({
  temperature: { min: 0, max: 45, safeMin: 16, safeMax: 30 },
  soil_moisture: { min: 0, max: 100, safeMin: 30, safeMax: 70 },
  humidity: { min: 0, max: 100, safeMin: 40, safeMax: 85 },
  light: { min: 0, max: 60000, safeMin: 3000, safeMax: 50000 },
  ph: { min: 3, max: 10, safeMin: 5.5, safeMax: 7.2 }
})
const TOPIC_CONTEXT = Object.freeze({
  product: { kicker: 'PRODUCTION LAYERS', label: '生产态势', note: '作物、环境与生长阶段', legend: [{ icon: 'crop-point', label: '作物点' }, { icon: 'aquaculture-point', label: '水产点' }, { icon: 'sensor', label: '遥测点' }] },
  security: { kicker: 'SECURITY LAYERS', label: '安全巡防', note: '围栏、摄像头与巡航', legend: [{ icon: 'camera', label: '摄像头' }, { icon: 'field-label', label: '电子围栏' }, { icon: 'drone', label: '巡航' }] },
  ai: { kicker: 'AI MANAGED OPS', label: 'AI 托管', note: '建议、审批与审计', legend: [{ icon: 'sensor', label: '观测' }, { icon: 'alert-climate', label: '待审批' }, { icon: 'alert-pest', label: '阻断' }] },
  value: { kicker: 'VALUE FORECAST', label: '产值预测', note: '预测指数 0–100', legend: [{ icon: 'value-crop', label: '种植产值' }, { icon: 'value-aquaculture', label: '水产产值' }, { icon: 'field-label', label: '未分类' }] },
  operations: { kicker: 'RESOURCE & MOBILE ASSETS', label: '运营保障', note: '资源、设施与农机运转', legend: [{ icon: 'tractor', label: '农机' }, { icon: 'water-control', label: '水利设备' }, { icon: 'warehouse', label: '园区设施' }] },
  alerts: { kicker: 'EARLY WARNING', label: '预警中心', note: '单一风险图层与事件', legend: [{ icon: 'alert-climate', label: '气候预警' }, { icon: 'alert-pest', label: '虫害预警' }, { icon: 'sensor', label: '风险热区' }] }
})
const activeTopicContext = computed(() => TOPIC_CONTEXT[activeTopic.value])
const topicIcons = Object.freeze({ product: 'seedling', security: 'shield-check', ai: 'settings', value: 'activity', operations: 'tractor', alerts: 'alert-triangle' })
const workspaceTopics = Object.entries(TOPIC_CONTEXT).map(([id, item]) => ({ id, label: item.label, icon: topicIcons[id] }))
watch([inspectorVisible, mobilePanelExpanded, eventsCollapsed, inboxOpen, attachments, fileError], async () => {
  await nextTick()
  emit('workspace-layout', {
    panelVisible: inspectorVisible.value,
    mobileExpanded: mobilePanelExpanded.value,
    eventsOpen: inboxOpen.value || !eventsCollapsed.value,
    hasAttachments: attachments.value.length > 0 || Boolean(fileError.value)
  })
}, { deep: true })
watch(() => props.selectedMachinery?.id, (id) => { if (id) inspectorVisible.value = true })
watch(() => props.selectedObject?.key, (key) => {
  if (!key) return
  inboxOpen.value = false
  eventsCollapsed.value = true
  inspectorVisible.value = true
  mobilePanelExpanded.value = true
})
watch(() => props.topic, (topic) => {
  if (!TOPIC_CONTEXT[topic]) return
  mobilePanelExpanded.value = false
  inspectorVisible.value = true
  legendExpanded.value = false
  if (topic === activeTopic.value) return
  activeTopic.value = topic
})
const readingVisuals = computed(() => readings.value.map(([key, reading]) => {
  const range = READING_RANGES[key]
  const numericValue = Number(reading?.value)
  const known = Number.isFinite(numericValue)
  const status = !known ? 'unknown' : numericValue >= range.safeMin && numericValue <= range.safeMax ? 'normal' : 'attention'
  return { key, ...reading, ...range, known, status, numericValue: known ? numericValue : null }
}))
const knownReadingCount = computed(() => readingVisuals.value.filter((item) => item.known).length)
const onlineNodeDisplay = computed(() => props.state.connection === 'online' ? props.state.nodes.length : '--')
const onlineNodeCaption = computed(() => props.state.connection === 'online'
  ? 'ACTIVE NODES'
  : props.state.nodes.length ? `LAST OBSERVED ${props.state.nodes.length}` : 'NO LIVE DATA')
const dataFreshnessLabel = computed(() => {
  displayClock.value
  if (!knownReadingCount.value || !props.state.lastUpdatedAt) return '遥测未采集'
  const age = Math.max(0, Date.now() - new Date(props.state.lastUpdatedAt).getTime())
  if (age > 15 * 60_000) return '遥测已过期'
  return `更新于 ${new Date(props.state.lastUpdatedAt).toLocaleTimeString('zh-CN', { hour12: false })}`
})
const systemHealth = computed(() => {
  if (props.state.connection !== 'online') return { tone: 'offline', label: props.state.connectionLabel, detail: '网关不可用' }
  if (!props.state.nodes.length || !knownReadingCount.value) return { tone: 'partial', label: '网关已连', detail: '业务数据不可用' }
  return { tone: 'online', label: '系统在线', detail: dataFreshnessLabel.value }
})
const globalAttentionCount = computed(() => props.attentionItems.length)
const activeJobs = computed(() => props.operationsDashboard.machinery.items.filter(item => item.status === 'running').slice(0, 3))
const publicHealthScore = computed(() => {
  const total = readingVisuals.value.length || 1
  const collected = knownReadingCount.value
  const attention = readingVisuals.value.filter((item) => item.status === 'attention').length
  return Math.max(0, Math.round(((collected - attention * 0.5) / total) * 100))
})
const publicLatestEvent = computed(() => props.state.events?.[0] || { type: 'SYSTEM.READY', text: '等待实时业务事件', time: '--:--:--' })
const publicEquipmentTotal = computed(() => props.operationsDashboard.equipment.total + props.operationsDashboard.machinery.total)
const publicOnlineEquipment = computed(() => props.operationsDashboard.equipment.counts.running + props.operationsDashboard.equipment.counts.standby + props.operationsDashboard.machinery.counts.running + props.operationsDashboard.machinery.counts.standby + props.operationsDashboard.machinery.counts.charging)
const publicResourceSummary = computed(() => {
  const definitions = [
    ['water', '水', 'm³'],
    ['electricity', '电', 'kWh'],
    ['fertilizer', '肥液', 'L'],
    ['pesticide', '农药', 'L']
  ]
  return definitions.map(([key, label, unit]) => {
    const metric = props.operationsDashboard.resources.day.summary[key] || { current: 0, target: 0, delta: 0 }
    const ratio = metric.target ? Math.round((metric.current / metric.target) * 100) : 0
    return { key, label, unit, current: metric.current, target: metric.target, delta: metric.delta, ratio, status: ratio > 105 ? 'attention' : 'normal' }
  })
})
const publicPrimaryJob = computed(() => activeJobs.value[0] || props.operationsDashboard.machinery.items.find((item) => item.status === 'standby') || null)
const publicRiskBreakdown = computed(() => [
  { key: 'warning', label: '高风险', value: props.alertCenter.counts.warning, tone: 'warning' },
  { key: 'attention', label: '需关注', value: props.alertCenter.counts.attention, tone: 'attention' },
  { key: 'normal', label: '低风险', value: Math.max(0, props.alertCenter.counts.total - props.alertCenter.counts.warning - props.alertCenter.counts.attention), tone: 'normal' }
])
const publicMachineryStats = computed(() => ({
  coverageArea: props.operationsDashboard.machinery.coverageArea,
  runtimeToday: props.operationsDashboard.machinery.runtimeToday,
  averageEnergy: props.operationsDashboard.machinery.averageEnergy,
  locatedCount: props.operationsDashboard.machinery.locatedCount,
  total: props.operationsDashboard.machinery.total
}))

function readingRange(key) {
  return READING_RANGES[key] || { min: 0, max: 100, safeMin: 0, safeMax: 100 }
}

const machineryLegend = Object.keys(MACHINERY_ICON_IDS).map((key) => ({
  key, label: FACILITY_TYPE_LABELS[key]
}))

function riskBarWidth(count, total) {
  const numericCount = Number(count) || 0
  if (numericCount <= 0) return '0%'
  return `${Math.max(18, numericCount / Math.max(Number(total) || 0, 1) * 100)}%`
}

onMounted(() => {
  // 首屏优先保留地图视野，完整事件流仍可由右上角按钮展开。
  eventsCollapsed.value = true
})
const agents = Object.freeze([
  { id: 'agri-advisor', label: '农业顾问', hint: '作物与环境' },
  { id: 'ops-engineer', label: '运维工程师', hint: '设备与网关' },
  { id: 'security-analyst', label: '安防分析', hint: '围栏与摄像头' }
])
const activeAgent = computed(() => agents.find((agent) => agent.id === activeAgentId.value) || agents[0])
const productionProfiles = Object.freeze({
  'greenhouse-1': { name: '1号温室', crop: '有机番茄 春茬', batch: 'ORG-2024-01', stage: '坐果期', progress: 62, area: '核心温室区' },
  'field-a': { name: 'A区露地', crop: '有机生菜 夏茬', batch: 'ORG-2024-02', stage: '叶片生长期', progress: 48, area: '西侧露地区' },
  'orchard-b': { name: 'B区果园', crop: '有机柑橘 秋梢', batch: 'ORG-2024-03', stage: '膨果期', progress: 71, area: '北侧果园区' }
})
const productionProfile = computed(() => productionProfiles[props.state.activeField] || { name: props.state.activeField, crop: '待识别作物', batch: '待绑定批次', stage: '待确认阶段', progress: 0, area: '待确认区域' })
const pestWarningProfiles = Object.freeze({
  'greenhouse-1': { pest: '粉虱', severity: 'attention', severityLabel: '关注', risk: '中风险', confidence: '78%', affectedArea: '东侧 2 排', evidence: '叶片背面疑似虫卵斑', recommendation: '加强通风并安排叶背复核', source: 'demo-baseline' },
  'field-a': { pest: '蚜虫', severity: 'warning', severityLabel: '预警', risk: '高风险', confidence: '84%', affectedArea: '西南角 0.6 ha', evidence: '新梢卷曲与聚集点', recommendation: '优先巡检边缘行，按植保方案处置', source: 'demo-baseline' },
  'orchard-b': { pest: '柑橘木虱', severity: 'normal', severityLabel: '低风险', risk: '低风险', confidence: '66%', affectedArea: '北侧 12 株', evidence: '诱捕板计数轻微上升', recommendation: '维持诱捕监测，48 小时后复核', source: 'demo-baseline' }
})
const pestWarning = computed(() => pestWarningProfiles[props.state.activeField] || { pest: '待识别', severity: 'pending', severityLabel: '待采集', risk: '待确认', confidence: '--', affectedArea: '待定位', evidence: '尚无病虫害识别证据', recommendation: '接入识别服务后再生成处置建议', source: 'demo-baseline' })
const productionChecks = computed(() => {
  const checks = [
    ['温度', props.state.readings.temperature, 16, 30],
    ['土壤水分', props.state.readings.soil_moisture, 30, 70],
    ['空气湿度', props.state.readings.humidity, 40, 85],
    ['光照', props.state.readings.light, 3000, 50000],
    ['pH', props.state.readings.ph, 5.5, 7.2]
  ]
  return checks.map(([label, reading, min, max]) => {
    const value = Number(reading?.value)
    const known = Number.isFinite(value)
    return { label, status: known && value >= min && value <= max ? 'normal' : known ? 'attention' : 'pending', text: known ? (value >= min && value <= max ? '正常' : '关注') : '待采集' }
  })
})
const attentionCount = computed(() => productionChecks.value.filter((item) => item.status === 'attention').length)
const productionHealthLabel = computed(() => attentionCount.value ? `${attentionCount.value} 项需关注` : productionChecks.value.some((item) => item.status === 'pending') ? '等待数据' : '运行正常')
const productionHealthStatus = computed(() => attentionCount.value ? 'attention' : productionChecks.value.some((item) => item.status === 'pending') ? 'pending' : 'normal')

function submitCommand() {
  const value = command.value.trim()
  if (!value) {
    if (attachments.value.length) fileError.value = '附件尚未上传，请输入文字说明后发送'
    return
  }
  emit('command', {
    content: value,
    agentId: activeAgent.value.id,
    agentLabel: activeAgent.value.label,
    attachments: attachments.value.map(({ id, name, type, size, kind }) => ({ id, name, type, size, kind, uploaded: false }))
  })
  command.value = ''
  clearAttachments()
}

function openFilePicker() {
  fileInput.value?.click()
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function handleFiles(event) {
  const files = [...(event.target.files || [])]
  fileError.value = ''
  const acceptedTypes = /^(image\/|application\/pdf$|text\/plain$|text\/csv$|text\/markdown$|application\/msword$|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$)/
  const accepted = files.filter((file) => acceptedTypes.test(file.type) && file.size <= 10 * 1024 * 1024)
  if (accepted.length !== files.length) fileError.value = '仅支持图片、PDF、DOC、DOCX、TXT、CSV，单个不超过 10 MB'
  const available = Math.max(0, 5 - attachments.value.length)
  if (accepted.length > available) fileError.value = '最多同时添加 5 个文件'
  accepted.slice(0, available).forEach((file) => {
    const kind = file.type.startsWith('image/') ? 'image' : 'file'
    attachments.value.push({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      kind,
      url: kind === 'image' ? URL.createObjectURL(file) : ''
    })
  })
  event.target.value = ''
}

function removeAttachment(id) {
  const index = attachments.value.findIndex((item) => item.id === id)
  if (index < 0) return
  const [removed] = attachments.value.splice(index, 1)
  if (removed.url) URL.revokeObjectURL(removed.url)
}

function clearAttachments() {
  attachments.value.forEach((item) => item.url && URL.revokeObjectURL(item.url))
  attachments.value = []
  fileError.value = ''
}

function selectTopic(topic, event) {
  if (props.mapStatus !== 'ready') return
  const button = event?.currentTarget
  mobilePanelExpanded.value = false
  inspectorVisible.value = true
  legendExpanded.value = false
  activeTopic.value = topic
  emit('topic', topic)
  requestAnimationFrame(() => button?.scrollIntoView({ block: 'nearest', inline: 'center' }))
}

async function handleTopicKeydown(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]:not(:disabled)')]
  const currentTab = event.target.closest('[role="tab"]')
  const currentIndex = tabs.indexOf(currentTab)
  if (currentIndex < 0) return

  event.preventDefault()
  let nextIndex = currentIndex
  if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = tabs.length - 1
  else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
  else nextIndex = (currentIndex + 1) % tabs.length

  const nextTab = tabs[nextIndex]
  selectTopic(nextTab.dataset.topic, { currentTarget: nextTab })
  await nextTick()
  document.getElementById(nextTab.id)?.focus()
}

function triggerMapAction(action) {
  if (props.mapStatus !== 'ready') return
  const next = new Set(activeActions.value)
  if (action === 'drone' || action === 'invade' || action === 'satellite') {
    if (next.has(action)) next.delete(action)
    else next.add(action)
  }
  activeActions.value = next
  emit('map-action', action)
}

function setMapView(view) {
  if (props.mapStatus !== 'ready') return
  emit('map-action', view === '2d' ? 'view-2d' : 'view-3d')
}

function toggleEvents() {
  inboxOpen.value = false
  eventsCollapsed.value = !eventsCollapsed.value
}

function toggleInbox() {
  eventsCollapsed.value = true
  inboxOpen.value = !inboxOpen.value
}

function openInboxItem(item) {
  inboxOpen.value = false
  eventsCollapsed.value = true
  inspectorVisible.value = true
  emit('inbox-open', item)
  nextTick(() => { mobilePanelExpanded.value = true })
}

function syncFullscreenState() {
  const next = typeof document !== 'undefined' && Boolean(document.fullscreenElement)
  if (next === isFullscreen.value) return
  isFullscreen.value = next
  if (!next && presentationMode.value) {
    presentationMode.value = false
    emit('fullscreen', { active: false })
  }
}

async function toggleFullscreen() {
  const next = !presentationMode.value
  presentationMode.value = next
  emit('fullscreen', { active: next })
  if (!fullscreenSupported && next) {
    emit('fullscreen-error', '当前浏览器不支持大屏模式')
    return
  }
  try {
    if (!next && document.fullscreenElement) await document.exitFullscreen()
    else if (next && fullscreenSupported) await document.documentElement.requestFullscreen()
    syncFullscreenState()
  } catch (error) {
    emit('fullscreen-error', error?.message || '大屏模式未能开启')
  }
}

if (typeof document !== 'undefined') document.addEventListener('fullscreenchange', syncFullscreenState)
onBeforeUnmount(() => {
  clearAttachments()
  if (displayClockTimer) window.clearInterval(displayClockTimer)
  if (typeof document !== 'undefined') document.removeEventListener('fullscreenchange', syncFullscreenState)
})
</script>

<template>
  <main :class="['farmclaw-hud', 'workspace-v2', { 'mobile-panel-expanded': mobilePanelExpanded, 'has-attachments': attachments.length || fileError, 'pane-hidden': !inspectorVisible, 'events-open': inboxOpen || !eventsCollapsed, 'legend-open': legendExpanded, 'presentation-active': presentationMode }]">
    <header v-if="!presentationMode" class="hud-header hud-panel">
      <div class="brand">
        <img class="brand-logo" :src="brandLogoUrl" alt="四时 SEASONS" />
        <span class="brand-caption">数字孪生农场</span>
      </div>
      <WorkspaceSearch :objects="objects" :ready="mapStatus === 'ready'" @select="emit('object-open', $event)" />
      <div class="system-status">
        <div :class="['connection-state', systemHealth.tone]" :aria-label="`${systemHealth.label}，${systemHealth.detail}`">
          <span :class="['status-mark', systemHealth.tone]" aria-hidden="true"></span>
          <span><small>数据连接</small><strong>{{ systemHealth.label }}</strong><em>{{ systemHealth.detail }}</em></span>
        </div>
        <div class="status-meta status-meta-secondary"><small>在线节点</small><strong>{{ onlineNodeDisplay }}</strong><em>{{ onlineNodeCaption }}</em></div>
        <div class="status-meta"><small>当前分区</small><strong>{{ productionProfile.name }}</strong><em>只读观测</em></div>
        <button class="workspace-inbox-trigger" type="button" :aria-expanded="inboxOpen" aria-label="待办中心" title="待办中心" @click="toggleInbox"><TablerIcon name="alert-triangle" :size="18" /><span>{{ globalAttentionCount }} 待办</span></button>
        <button class="workspace-event-trigger" type="button" :aria-expanded="!eventsCollapsed" :aria-label="eventsCollapsed ? '展开系统事件' : '收起系统事件'" title="系统日志" @click="toggleEvents"><TablerIcon name="activity" :size="18" /><span>日志</span></button>
        <button class="fullscreen-toggle" :class="{ active: presentationMode }" :aria-pressed="presentationMode" type="button" aria-label="切换大屏模式" title="进入对外展示大屏" @click="toggleFullscreen"><TablerIcon name="maximize" :size="16" /><span>大屏</span></button>
      </div>
    </header>

    <section v-else class="public-dashboard" aria-label="四时对外展示大屏">
      <header class="public-dashboard-header">
        <div>
          <span class="public-kicker">SISHI / AGRICULTURAL AGENT COMMAND CENTER</span>
          <img class="public-brand-logo" :src="brandLogoUrl" alt="四时 SEASONS" />
          <p>生产运营 · 风险预警 · 设施物联一体化展示</p>
        </div>
        <div class="public-header-right">
          <span :class="['public-live', systemHealth.tone]"><i></i>{{ systemHealth.label }} · {{ systemHealth.detail }}</span>
          <span class="public-clock">{{ displayClock }}</span>
          <button type="button" class="public-exit" @click="toggleFullscreen">退出大屏</button>
        </div>
      </header>
      <div class="public-dashboard-grid">
        <section class="public-map-overlay" aria-label="数字孪生地图状态">
          <div class="public-map-overlay-head">
            <span class="public-map-label">LIVE DIGITAL TWIN / 01</span>
            <strong>{{ productionProfile.name }}</strong>
            <em>{{ mapView === '3d' ? '3D SPATIAL VIEW' : '2D SITE VIEW' }}</em>
          </div>
          <div class="public-map-overlay-meta">
            <span><small>HEALTH INDEX</small><strong>{{ publicHealthScore }}<b>/100</b></strong></span>
            <span><small>FIELD</small><strong>{{ state.activeField }}</strong></span>
            <span><small>LAST SYNC</small><strong>{{ dataFreshnessLabel.replace('更新于 ', '') }}</strong></span>
          </div>
          <div class="public-map-telemetry" aria-label="环境遥测状态">
            <article v-for="reading in readingVisuals" :key="reading.key" :class="reading.status">
              <span>{{ reading.label }}</span>
              <strong>{{ reading.known ? reading.value : '--' }}<b>{{ reading.unit }}</b></strong>
              <em>{{ reading.known ? (reading.status === 'normal' ? 'NORMAL' : 'ATTENTION') : 'NO SIGNAL' }}</em>
            </article>
          </div>
          <div class="public-map-event">
            <span><i></i>RECENT EVENT / {{ publicLatestEvent.type }}</span>
            <strong>{{ publicLatestEvent.text }}</strong>
            <time>{{ publicLatestEvent.time }}</time>
          </div>
        </section>
        <section class="public-panel public-kpis">
          <div class="public-panel-title"><span>OPERATING OVERVIEW</span><strong>运营总览</strong></div>
          <div class="public-kpi-grid">
            <article><small>在线节点</small><strong>{{ onlineNodeDisplay }}</strong><em>{{ onlineNodeCaption }}</em></article>
            <article><small>设施总数</small><strong>{{ operationsDashboard.equipment.total }}</strong><em>FACILITIES</em></article>
            <article><small>作业农机</small><strong>{{ operationsDashboard.machinery.activeTasks }}</strong><em>MACHINERY</em></article>
            <article class="attention"><small>风险预警</small><strong>{{ alertCenter.counts.total }}</strong><em>ALERTS</em></article>
          </div>
          <div class="public-status-line"><span><i></i>{{ systemHealth.detail }}</span><span>{{ dataFreshnessLabel }}</span></div>
          <div class="public-link-stats"><span><small>EVENT BUFFER</small><strong>{{ state.events.length }} / 12</strong></span><span><small>ONLINE ASSETS</small><strong>{{ publicOnlineEquipment }} / {{ publicEquipmentTotal }}</strong></span></div>
          <div class="public-resource-grid" aria-label="今日资源消耗">
            <article v-for="resource in publicResourceSummary" :key="resource.key">
              <div><small>{{ resource.label }}消耗</small><strong>{{ resource.current }}<em>{{ resource.unit }}</em></strong></div>
              <span><i :class="resource.status"></i>{{ resource.ratio }}% / 目标 {{ resource.target }}</span>
              <b :class="resource.status" :style="{ width: `${Math.min(resource.ratio, 100)}%` }"></b>
            </article>
          </div>
        </section>
        <section class="public-panel public-production">
          <div class="public-panel-title"><span>PRODUCTION STATUS</span><strong>生产态势</strong><em>{{ productionProfile.name }}</em></div>
          <div class="public-production-main"><div><small>当前作物</small><strong>{{ productionProfile.crop }}</strong><span>{{ productionProfile.stage }} · {{ productionProfile.progress }}%</span></div><div class="public-progress"><i><b :style="{ width: `${productionProfile.progress}%` }"></b></i><small>生长阶段进度</small></div></div>
          <div class="public-reading-strip"><article v-for="([key, reading]) in readings.slice(0, 4)" :key="key"><small>{{ reading.label }}</small><strong>{{ reading.value }}<em>{{ reading.unit }}</em></strong></article></div>
          <div class="public-check-grid"><span v-for="check in productionChecks" :key="check.label" :class="check.status"><i></i>{{ check.label }}<b>{{ check.text }}</b></span></div>
          <div class="public-production-meta">
            <span><small>批次编号</small><strong>{{ productionProfile.batch }}</strong></span>
            <span><small>作业区域</small><strong>{{ productionProfile.area }}</strong></span>
            <span><small>当前作业</small><strong>{{ publicPrimaryJob?.task || '暂无调度任务' }}</strong></span>
          </div>
        </section>
        <section class="public-panel public-alerts">
          <div class="public-panel-title"><span>RISK MONITOR</span><strong>预警中心</strong><em>{{ alertCenter.activeField }}</em></div>
          <div class="public-alert-summary"><div class="risk-total"><small>ACTIVE ALERTS</small><strong>{{ alertCenter.counts.total }}</strong><em>项风险事件</em><span>气候 {{ alertCenter.counts.climate }} · 虫害 {{ alertCenter.counts.pest }}</span></div><div class="risk-bars"><p><span>气候预警</span><i><b :style="{ width: riskBarWidth(alertCenter.counts.climate, alertCenter.counts.total) }"></b></i><strong>{{ alertCenter.counts.climate }}</strong></p><p><span>虫害预警</span><i class="pest"><b :style="{ width: riskBarWidth(alertCenter.counts.pest, alertCenter.counts.total) }"></b></i><strong>{{ alertCenter.counts.pest }}</strong></p></div></div>
          <div class="public-risk-breakdown"><span v-for="item in publicRiskBreakdown" :key="item.key" :class="item.tone"><i></i>{{ item.label }} <strong>{{ item.value }}</strong></span></div>
          <div class="public-alert-list"><article v-for="alert in alertCenter.alerts.slice(0, 3)" :key="alert.id"><i :class="alert.severity"></i><div><strong>{{ alert.title }}</strong><small>{{ alert.scope }} · {{ alert.typeLabel }}</small></div><em>{{ alert.severityLabel }}</em></article></div>
        </section>
        <section class="public-panel public-equipment">
          <div class="public-panel-title"><span>FACILITY + MACHINERY TELEMETRY</span><strong>设施与农机状态</strong><em>{{ operationsDashboard.equipment.total + operationsDashboard.machinery.total }} 台</em></div>
           <div class="equipment-counts"><span class="running"><i></i>运行 {{ operationsDashboard.equipment.counts.running + operationsDashboard.machinery.counts.running }}</span><span class="standby"><i></i>待机 {{ operationsDashboard.equipment.counts.standby + operationsDashboard.machinery.counts.standby }}</span><span class="charging"><i></i>充电 {{ operationsDashboard.machinery.counts.charging }}</span><span class="warning"><i></i>异常 {{ operationsDashboard.equipment.counts.warning + operationsDashboard.machinery.counts.warning }}</span><span class="offline"><i></i>离线 {{ operationsDashboard.equipment.counts.offline + operationsDashboard.machinery.counts.offline }}</span></div>
           <div class="public-device-list"><article v-for="device in operationsDashboard.equipment.items.slice(0, 3)" :key="device.id"><img class="asset-glyph" :src="facilityIconDataUri(equipmentIconKey(device.category, device.name))" :alt="device.category" /><div><strong>{{ device.name }}</strong><small>{{ device.zone }} · {{ device.load }}% 负载 · {{ device.id }}</small></div><em :class="device.status">{{ device.statusLabel }}</em></article><article v-for="machine in operationsDashboard.machinery.items.slice(0, 3)" :key="machine.id"><img class="asset-glyph" :src="facilityIconDataUri(machine.type)" :alt="machine.typeLabel" /><div><strong>{{ machine.name }}</strong><small>{{ machine.zone }} · {{ machine.speed }} km/h · {{ machine.progress }}%</small></div><em :class="machine.status">{{ machine.statusLabel }}</em></article></div>
           <div class="public-machinery-stats"><span><small>覆盖面积</small><strong>{{ publicMachineryStats.coverageArea }} ha</strong></span><span><small>今日作业</small><strong>{{ publicMachineryStats.runtimeToday }} h</strong></span><span><small>平均能量</small><strong>{{ publicMachineryStats.averageEnergy }}%</strong></span><span><small>已定位</small><strong>{{ publicMachineryStats.locatedCount }}/{{ publicMachineryStats.total }}</strong></span></div>
         </section>
        <div class="public-dashboard-footer"><span>演示展示数据 · demo-baseline · 不代表真实生产、气象或虫害识别结果</span><span>MAP · {{ mapProvider }}　|　FIELD · {{ state.activeField }}</span></div>
      </div>
    </section>

    <template v-if="!presentationMode">

    <WorkspaceObjectDetail v-if="selectedObject" id="workspace-object-detail" :object="selectedObject" :items="attentionItems" :history="objectHistory" @close="emit('object-close')" @locate="emit('object-locate', $event)" @acknowledge="emit('object-acknowledge', $event)" @open-item="openInboxItem" />
    <div v-show="!selectedObject" class="topic-panel-host">
    <section id="topic-panel-product" v-if="activeTopic === 'product'" class="telemetry-panel hud-panel" role="tabpanel" aria-labelledby="topic-tab-product">
      <div class="panel-heading">
        <div class="workspace-panel-title"><TablerIcon name="seedling" :size="19" aria-hidden="true" /><div><span>生产总览</span><strong>{{ productionProfile.name }}</strong></div></div>
        <em :class="['data-freshness', { ready: knownReadingCount, stale: knownReadingCount && dataFreshnessLabel === '遥测已过期' }]">{{ dataFreshnessLabel }}</em>
      </div>
      <section class="production-detail" aria-label="生产详情">
        <div class="production-detail-heading"><span>作物档案</span><small>{{ productionProfile.area }}</small></div>
        <div class="production-profile-main"><strong>{{ productionProfile.crop }}</strong><em>{{ productionProfile.stage }}</em></div>
        <div class="production-meta"><span>批次 <strong>{{ productionProfile.batch }}</strong></span><span>区域 <strong>{{ productionProfile.name }}</strong></span></div>
        <div class="production-progress"><div><span>阶段进度</span><strong>{{ productionProfile.progress }}%</strong></div><i><b :style="{ width: `${productionProfile.progress}%` }"></b></i></div>
        <small class="production-baseline">作物档案 · 演示基线</small>
        <section class="production-attention" aria-label="优先处理">
          <header><strong>优先处理</strong><button type="button" @click="toggleInbox">全部 {{ globalAttentionCount }}<TablerIcon name="chevron-right" :size="14" /></button></header>
          <button v-for="item in attentionItems.slice(0, 3)" :key="item.key" class="production-attention-row" type="button" @click="openInboxItem(item)"><TablerIcon name="alert-triangle" :size="16" /><span><strong>{{ item.title }}</strong><small>{{ item.scope }} · {{ item.source }}</small></span><TablerIcon name="chevron-right" :size="14" /></button>
          <p v-if="!attentionItems.length" class="workspace-empty">当前无待办事项</p>
        </section>
        <section class="production-jobs" aria-label="作业进展">
          <header><strong>作业进展</strong><small>演示农机</small></header>
          <button v-for="job in activeJobs" :key="job.id" type="button" @click="emit('object-open', objects.find(item => item.key === `machinery:${job.id}`))"><img :src="facilityIconDataUri(job.type)" alt="" /><span><strong>{{ job.name }}</strong><small>{{ job.zone }}</small></span><em>{{ job.progress }}%</em></button>
        </section>
        <section class="production-telemetry" aria-label="环境快照">
          <header><strong>环境快照</strong><small>{{ knownReadingCount }}/{{ readings.length }} 项已采集</small></header>
          <dl><div v-for="reading in readingVisuals" :key="reading.key"><dt>{{ reading.label }}</dt><dd>{{ reading.known ? reading.value : '--' }}<small>{{ reading.unit }}</small></dd></div></dl>
          <details><summary>详细遥测与适宜区间</summary><div class="reading-grid"><SignalGauge v-for="reading in readingVisuals" :key="reading.key" :label="reading.label" :value="reading.value" :unit="reading.unit" :min="reading.min" :max="reading.max" :safe-min="reading.safeMin" :safe-max="reading.safeMax" /></div></details>
        </section>
        <div class="production-checks"><article v-for="item in productionChecks" :key="item.label" :class="item.status"><i></i><span>{{ item.label }}</span><strong>{{ item.text }}</strong></article></div>
        <p class="production-health"><i :class="productionHealthStatus"></i>生产健康：{{ productionHealthLabel }} · 基于当前遥测快照</p>
        <section class="pest-warning" aria-label="虫害预警">
          <div class="pest-heading"><span>植保观测</span><em :class="pestWarning.severity">{{ pestWarning.severityLabel }}</em></div>
          <div class="pest-main"><strong>{{ pestWarning.pest }}</strong><span>{{ pestWarning.risk }} · 置信度 {{ pestWarning.confidence }}</span></div>
          <p>{{ pestWarning.evidence }} · 影响范围 {{ pestWarning.affectedArea }}</p>
          <small>建议：{{ pestWarning.recommendation }}</small>
          <small class="pest-disclaimer">演示预警 · 尚未接入病虫害识别服务 · {{ pestWarning.source }}</small>
        </section>
      </section>
      <p v-if="state.lastUpdatedAt">最近更新 {{ new Date(state.lastUpdatedAt).toLocaleTimeString('zh-CN', { hour12: false }) }}</p>
      <p v-else>等待 IoT 节点遥测数据</p>
    </section>

    <SecurityPanel
      id="topic-panel-security"
      v-else-if="activeTopic === 'security'"
      :state="securityState"
      :selected="selectedSecurityFeature"
      role="tabpanel"
      aria-labelledby="topic-tab-security"
      @action="emit('security-action', $event)"
    />

    <AiManagedPanel
      id="topic-panel-ai"
      v-else-if="activeTopic === 'ai'"
      :state="aiState"
      :registry="aiRegistry"
      :focus-task-id="focusTaskId"
      role="tabpanel"
      aria-labelledby="topic-tab-ai"
      @action="emit('ai-action', $event)"
    />

    <ValueForecastPanel
      id="topic-panel-value"
      v-else-if="activeTopic === 'value'"
      :model="valueForecast"
      role="tabpanel"
      aria-labelledby="topic-tab-value"
      @filter="emit('value-filter', $event)"
    />

    <OperationsPanel
      id="topic-panel-operations"
      v-else-if="activeTopic === 'operations'"
      :model="operationsDashboard"
      :selected-machinery="selectedMachinery"
      role="tabpanel"
      aria-labelledby="topic-tab-operations"
      @action="emit('operations-action', $event)"
    />

    <AlertCenterPanel
      id="topic-panel-alerts"
      v-else-if="activeTopic === 'alerts'"
      :model="alertCenter"
      role="tabpanel"
      aria-labelledby="topic-tab-alerts"
      @filter="emit('alert-filter', $event)"
    />
    </div>

    <WorkspaceInbox v-if="inboxOpen" :items="attentionItems" @close="inboxOpen = false" @open="openInboxItem" />
    <aside :class="['event-panel', 'hud-panel', { collapsed: eventsCollapsed }]" aria-label="系统事件">
      <div class="panel-heading">
        <div><span>EVENT STREAM</span><strong>系统日志</strong></div>
        <div class="event-heading-actions">
          <em class="event-count">{{ state.events.length.toString().padStart(2, '0') }}</em>
          <button
            class="event-toggle"
            type="button"
            :aria-expanded="(!eventsCollapsed).toString()"
            :aria-label="eventsCollapsed ? '展开系统事件' : '收起系统事件'"
            :title="eventsCollapsed ? '展开系统事件' : '收起系统事件'"
            @click="toggleEvents"
          >
            <TablerIcon :name="eventsCollapsed ? 'chevron-right' : 'chevron-up'" :size="17" />
          </button>
        </div>
      </div>
      <div v-if="!eventsCollapsed" class="event-list">
        <article v-for="event in state.events" :key="event.id" :class="event.type.toLowerCase().replaceAll('.', '-')">
          <time>{{ event.time }}</time>
          <strong>{{ event.type }}</strong>
          <p>{{ event.text }}</p>
        </article>
        <p v-if="!state.events.length" class="empty">等待网关事件</p>
      </div>
    </aside>

    <section v-if="!presentationMode" v-show="legendExpanded" :class="['map-context', 'hud-panel', 'legend-expanded', { 'operations-legend': activeTopic === 'operations' }]" aria-label="当前地图图例">
      <span v-if="activeTopic === 'operations'" class="legend-section-label">图层分类</span>
      <ul id="workspace-map-legend" class="status-legend">
        <li v-for="item in activeTopicContext.legend" :key="item.label"><img :src="facilityIconDataUri(item.icon)" alt="" />{{ item.label }}</li>
      </ul>
      <span v-if="activeTopic === 'operations'" class="legend-section-label">农机类型</span>
      <ul v-if="activeTopic === 'operations'" class="asset-legend" aria-label="农机类型图例">
        <li v-for="item in machineryLegend" :key="item.key" :title="item.label"><img :src="facilityIconDataUri(item.key)" alt="" /><span>{{ item.label }}</span></li>
      </ul>
      <div v-if="activeTopic === 'value'" class="context-scale" aria-label="预测指数尺度"><span>低 0</span><i></i><span>稳定 80</span><i></i><span>高潜 95</span></div>
      <div v-else-if="activeTopic === 'alerts'" class="context-scale risk-scale" aria-label="风险分数尺度"><span>低</span><i></i><span>中</span><i></i><span>高</span></div>
    </section>

    <div v-if="!presentationMode" class="map-context-controls hud-panel" role="toolbar" aria-label="地图视角与图例">
      <div class="map-view-switch" role="group" aria-label="地图视角">
        <button type="button" :disabled="mapStatus !== 'ready'" :aria-pressed="mapView === '2d'" aria-label="切换二维地图" title="二维地图" @click="setMapView('2d')"><TablerIcon name="map" :size="15" :stroke-width="1.55" /><span>二维</span></button>
        <button type="button" :disabled="mapStatus !== 'ready'" :aria-pressed="mapView === '3d'" aria-label="切换三维地图" title="三维地图" @click="setMapView('3d')"><TablerIcon name="box" :size="15" :stroke-width="1.55" /><span>三维</span></button>
      </div>
      <button class="legend-toggle" type="button" :aria-expanded="legendExpanded" aria-controls="workspace-map-legend" aria-label="展开或收起图例" title="图例" @click="legendExpanded = !legendExpanded"><TablerIcon name="list-details" :size="15" :stroke-width="1.55" /><span>图例</span></button>
    </div>

    <button v-if="!presentationMode" class="mobile-panel-toggle" type="button" :aria-expanded="mobilePanelExpanded" :aria-label="mobilePanelExpanded ? '收起分析' : '展开分析'" @click="mobilePanelExpanded = !mobilePanelExpanded"><span>{{ mobilePanelExpanded ? '收起' : '展开' }}</span><span>分析</span></button>

    <div v-if="!presentationMode" class="workspace-pane-control">
      <span>{{ productionProfile.area }}</span>
      <button type="button" :aria-expanded="inspectorVisible" :aria-label="inspectorVisible ? '收起分析面板' : '展开分析面板'" :title="inspectorVisible ? '收起分析面板' : '展开分析面板'" @click="inspectorVisible = !inspectorVisible"><TablerIcon :name="inspectorVisible ? 'arrow-left' : 'chevron-right'" :size="18" /><span>{{ inspectorVisible ? '收起' : '分析' }}</span></button>
    </div>
    <nav :class="['topic-bar', 'hud-panel', { 'has-attachments': attachments.length }]" aria-label="业务专题" role="tablist" @keydown="handleTopicKeydown">
      <button v-for="item in workspaceTopics" :id="`topic-tab-${item.id}`" :key="item.id" :data-topic="item.id" :class="{ active: activeTopic === item.id }" :aria-selected="activeTopic === item.id" :aria-controls="activeTopic === item.id ? selectedObject ? 'workspace-object-detail' : `topic-panel-${item.id}` : undefined" :tabindex="activeTopic === item.id ? 0 : -1" :disabled="mapStatus !== 'ready'" role="tab" type="button" @click="selectTopic(item.id, $event)"><TablerIcon :name="item.icon" :size="17" /><span>{{ item.label }}</span></button>
      <span class="topic-scroll-hint" aria-hidden="true"><TablerIcon name="chevron-right" :size="15" /></span>
    </nav>

    <div :class="['map-tools', 'hud-panel', { 'context-open': ['ai', 'security', 'value', 'operations', 'alerts'].includes(activeTopic), 'has-attachments': attachments.length }]" role="toolbar" aria-label="地图工具">
      <button data-tool="overview" :disabled="mapStatus !== 'ready'" type="button" aria-label="回到地图中心" title="园区总览" @click="triggerMapAction('center')"><TablerIcon name="focus-2" :size="15" :stroke-width="1.6" /><span>总览</span></button>
      <button data-tool="satellite" class="satellite-toggle" :class="{ active: activeActions.has('satellite') }" :aria-pressed="activeActions.has('satellite')" :disabled="mapStatus !== 'ready'" type="button" aria-label="切换卫星图" title="切换卫星图" @click="triggerMapAction('satellite')"><TablerIcon name="satellite" :size="15" :stroke-width="1.5" /><span>卫星</span></button>
      <button data-tool="drone" :class="{ active: activeActions.has('drone') }" :aria-pressed="activeActions.has('drone')" :disabled="mapStatus !== 'ready'" type="button" aria-label="切换无人机巡航" title="无人机巡航" @click="triggerMapAction('drone')"><TablerIcon name="drone" :size="15" :stroke-width="1.5" /><span>巡航</span></button>
      <button data-tool="alert" :class="{ active: activeActions.has('invade') }" :aria-pressed="activeActions.has('invade')" :disabled="mapStatus !== 'ready'" type="button" aria-label="切换越界告警" title="越界告警" @click="triggerMapAction('invade')"><TablerIcon name="alert-triangle" :size="15" :stroke-width="1.6" /><span>告警</span></button>
    </div>

    <form class="command-bar hud-panel" @submit.prevent="submitCommand">
      <div v-if="attachments.length || fileError" class="attachment-strip" aria-label="待发送附件">
        <span class="local-only">仅本地预览 · 尚未上传</span>
        <div v-for="attachment in attachments" :key="attachment.id" class="attachment-chip">
          <img v-if="attachment.kind === 'image'" :src="attachment.url" :alt="attachment.name" />
          <span v-else class="attachment-file-icon" aria-hidden="true"><TablerIcon name="file" :size="15" /></span>
          <strong :title="attachment.name">{{ attachment.name }}</strong>
          <small>{{ formatFileSize(attachment.size) }}</small>
          <button type="button" :aria-label="`移除附件 ${attachment.name}`" @click="removeAttachment(attachment.id)"><TablerIcon name="x" :size="15" /></button>
        </div>
        <em v-if="fileError" class="file-error">{{ fileError }}</em>
      </div>
      <div class="command-main">
        <label class="agent-picker" title="本地对话路由；后端尚未配置独立 Agent 服务">
          <span>AGENT · LOCAL</span>
          <select v-model="activeAgentId" aria-label="对话 Agent">
            <option v-for="agent in agents" :key="agent.id" :value="agent.id">{{ agent.label }}</option>
          </select>
        </label>
        <input v-model="command" :placeholder="`向${activeAgent.label}提问…`" aria-label="四时 Agent 指令" />
        <input ref="fileInput" class="file-input" type="file" accept="image/*,.pdf,.doc,.docx,.txt,.csv" tabindex="-1" aria-hidden="true" hidden multiple @change="handleFiles" />
        <button class="attach-button" type="button" aria-label="上传文件或图片" title="上传文件或图片" @click="openFilePicker"><TablerIcon name="paperclip" :size="18" /></button>
        <button type="submit"><TablerIcon name="send" :size="15" /><span>发送</span></button>
      </div>
    </form>

    <section v-if="mapStatus !== 'ready'" class="map-notice hud-panel">
      <strong>{{ mapStatus === 'loading' ? '正在初始化数字农场场景' : '地图场景未启动' }}</strong>
      <p v-if="mapError">{{ mapError }}</p>
      <p v-else>正在加载地图、三维模型与业务图层…</p>
      <small v-if="mapStatus === 'error'">可检查网络或在 .env.local 中配置其他 VITE_MAP_STYLE_URL；实时控制面仍可独立使用。</small>
    </section>
    </template>
  </main>
</template>

<style scoped>
.asset-glyph { width:36px; height:36px; flex:0 0 36px; object-fit:contain; }
.map-context .legend-section-label { display:block; padding-top:9px; color:var(--ops-text-muted); border-top:1px solid var(--ops-line-soft); font-size:10px; line-height:1.4; }
.map-context .asset-legend { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px 4px; }
.map-context .asset-legend li { min-width:0; display:flex; flex-direction:column; gap:3px; text-align:center; }
.map-context .asset-legend img { width:32px; height:32px; object-fit:contain; }
.map-context .asset-legend span { color:var(--ops-text-soft); font-size:10px; font-family:inherit; line-height:1.4; letter-spacing:0; overflow-wrap:anywhere; }
.map-context.operations-legend { max-height:min(68vh,560px); overflow-x:hidden; overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; }
.map-context.operations-legend :is(.status-legend,.asset-legend) { display:grid; grid-template-columns:1fr; gap:0; padding-top:2px; border-top:0; }
.map-context.operations-legend :is(.status-legend,.asset-legend) li { min-width:0; min-height:38px; display:grid; grid-template-columns:34px minmax(0,1fr); align-items:center; gap:9px; padding:3px 2px; text-align:left; border-bottom:1px solid var(--ops-line-soft); }
.map-context.operations-legend :is(.status-legend,.asset-legend) li:last-child { border-bottom:0; }
.map-context.operations-legend :is(.status-legend,.asset-legend) img { width:30px; height:30px; flex:0 0 30px; object-fit:contain; }
.map-context.operations-legend .asset-legend span { font-size:11px; }
@media (max-width:600px) {
  .map-context .asset-legend { display:flex; overflow-x:auto; padding-bottom:3px; }
  .map-context .asset-legend li { flex:0 0 70px; flex-direction:row; text-align:left; }
  .map-context .asset-legend img { width:28px; height:28px; }
  .map-context .asset-legend span { font-family:inherit; font-size:9px; }
  .map-context.operations-legend { max-height:48dvh; }
  .map-context.operations-legend :is(.status-legend,.asset-legend) { display:grid; overflow:visible; padding-bottom:0; }
  .map-context.operations-legend :is(.status-legend,.asset-legend) { grid-template-columns:1fr; }
  .map-context.operations-legend :is(.status-legend,.asset-legend) li { min-height:36px; grid-template-columns:31px minmax(0,1fr); }
  .map-context.operations-legend :is(.status-legend,.asset-legend) img { width:27px; height:27px; }
}
.farmclaw-hud { position:fixed; inset:0; z-index:900; pointer-events:none; color:var(--ops-text); font-family:var(--ops-font); }
.farmclaw-hud::before { content:""; position:absolute; inset:0; pointer-events:none; background:linear-gradient(90deg,oklch(8% .02 225/.44),transparent 24%,transparent 76%,oklch(8% .02 225/.44)),linear-gradient(0deg,oklch(8% .02 225/.34),transparent 22%); }
.public-dashboard { position:absolute; inset:0; overflow:hidden; color:var(--ops-text); background:linear-gradient(90deg,oklch(10% .024 225/.92) 0,oklch(10% .024 225/.56) 27%,transparent 39%,transparent 61%,oklch(10% .024 225/.58) 73%,oklch(10% .024 225/.93) 100%); }
.public-dashboard-header { position:absolute; z-index:2; top:0; left:0; right:0; height:92px; display:flex; align-items:center; justify-content:space-between; padding:0 34px; pointer-events:auto; border-bottom:1px solid var(--ops-line); background:var(--ops-surface); box-shadow:var(--ops-shadow); }
.public-kicker { color:var(--ops-accent); font:700 10px var(--ops-mono); letter-spacing:.16em; }.public-dashboard-header h1 { margin-top:6px; font-size:25px; font-weight:650; letter-spacing:.04em; }.public-dashboard-header p { margin-top:5px; color:var(--ops-text-muted); font-size:12px; }
.public-header-right { display:flex; align-items:center; gap:12px; }.public-live { padding:8px 11px; color:var(--ops-text-soft); border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); font:700 10px var(--ops-mono); }.public-live i { display:inline-block; width:7px; height:7px; margin-right:7px; border:2px solid var(--ops-warning); transform:rotate(45deg); }.public-clock { min-width:82px; font:700 18px var(--ops-mono); font-variant-numeric:tabular-nums; }.public-exit { min-height:40px; padding:0 14px; color:var(--ops-text); border:1px solid var(--ops-line); border-radius:var(--ops-radius-sm); background:var(--ops-surface-raised); cursor:pointer; font-size:12px; }.public-exit:hover { color:var(--ops-canvas); background:var(--ops-accent); }
.public-dashboard-grid { position:absolute; z-index:1; inset:108px 24px 18px; display:grid; grid-template-columns:330px minmax(280px,1fr) 350px; grid-template-rows:minmax(0,.9fr) minmax(0,1.1fr) 24px; grid-template-areas:"kpis map alerts" "production map equipment" "footer footer footer"; gap:14px 20px; pointer-events:none; }
.public-panel { position:relative; min-height:0; padding:16px; pointer-events:auto; overflow:hidden; border:1px solid var(--ops-line); border-radius:var(--ops-radius-md); background:var(--ops-surface); box-shadow:var(--ops-shadow); }.public-kpis { grid-area:kpis; }.public-production { grid-area:production; }.public-alerts { grid-area:alerts; }.public-equipment { grid-area:equipment; }
.public-panel::before { content:""; position:absolute; top:0; left:0; width:54px; height:2px; background:var(--ops-accent); opacity:.82; }
.public-panel-title { display:grid; grid-template-columns:1fr auto; align-items:end; padding-bottom:10px; border-bottom:1px solid var(--ops-line-soft); }.public-panel-title span { grid-column:1/-1; margin-bottom:4px; color:var(--ops-accent); font:700 10px var(--ops-mono); letter-spacing:.12em; }.public-panel-title strong { font-size:16px; font-weight:650; }.public-panel-title em { align-self:center; color:var(--ops-text-muted); font:10px var(--ops-mono); font-style:normal; }
.public-map-overlay { grid-area:map; min-width:0; display:flex; flex-direction:column; justify-content:space-between; gap:12px; padding:8px 0 4px; pointer-events:none; }
.public-map-overlay-head { align-self:center; min-width:min(430px,90%); display:grid; grid-template-columns:1fr auto; align-items:end; padding:9px 12px; border-top:1px solid var(--ops-line); border-bottom:1px solid var(--ops-line-soft); background:oklch(15% .025 225/.76); }
.public-map-label { grid-column:1/-1; margin-bottom:3px; color:var(--ops-accent); font:700 8px/1.3 var(--ops-mono); letter-spacing:.12em; }.public-map-overlay-head strong { font-size:14px; font-weight:650; }.public-map-overlay-head em { color:var(--ops-text-muted); font:8px var(--ops-mono); font-style:normal; }
.public-map-overlay-meta { align-self:flex-end; width:min(180px,42%); display:grid; gap:1px; margin-top:auto; border-left:1px solid var(--ops-line); background:var(--ops-line-soft); }.public-map-overlay-meta > span { min-width:0; display:grid; grid-template-columns:1fr auto; align-items:center; gap:8px; padding:6px 8px; background:oklch(15% .025 225/.76); }.public-map-overlay-meta small { color:var(--ops-text-muted); font:7px var(--ops-mono); }.public-map-overlay-meta strong { overflow:hidden; color:var(--ops-text); font:700 9px var(--ops-mono); text-overflow:ellipsis; white-space:nowrap; }.public-map-overlay-meta span:first-child strong { color:var(--ops-accent); font-size:17px; }.public-map-overlay-meta b { color:var(--ops-text-muted); font-size:8px; }
.public-map-telemetry { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:1px; border-top:1px solid var(--ops-line-soft); border-bottom:1px solid var(--ops-line-soft); background:var(--ops-line-soft); }.public-map-telemetry article { min-width:0; padding:7px 8px; background:oklch(15% .025 225/.82); }.public-map-telemetry span,.public-map-telemetry strong,.public-map-telemetry em { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.public-map-telemetry span { color:var(--ops-text-muted); font-size:8px; }.public-map-telemetry strong { margin-top:4px; font:700 13px var(--ops-mono); }.public-map-telemetry strong b { margin-left:2px; color:var(--ops-text-muted); font-size:7px; }.public-map-telemetry em { margin-top:3px; color:var(--ops-success); font:700 6px var(--ops-mono); font-style:normal; letter-spacing:.05em; }.public-map-telemetry article.attention em { color:var(--ops-warning); }.public-map-telemetry article.unknown em { color:var(--ops-text-muted); }
.public-map-event { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:10px; min-height:34px; padding:6px 9px; border-left:2px solid var(--ops-accent); background:oklch(15% .025 225/.84); }.public-map-event span { color:var(--ops-accent); font:700 7px var(--ops-mono); letter-spacing:.04em; }.public-map-event span i { width:5px; height:5px; display:inline-block; margin-right:5px; background:currentColor; }.public-map-event strong { min-width:0; overflow:hidden; color:var(--ops-text-soft); font-size:9px; font-weight:500; text-overflow:ellipsis; white-space:nowrap; }.public-map-event time { color:var(--ops-text-muted); font:8px var(--ops-mono); }
.public-kpi-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; margin-top:8px; border:1px solid var(--ops-line-soft); background:var(--ops-line-soft); }.public-kpi-grid article { min-width:0; min-height:58px; display:grid; grid-template-columns:1fr auto; align-items:center; gap:4px 8px; padding:8px; background:var(--ops-surface-inset); }.public-kpi-grid small { color:var(--ops-text-soft); font-size:11px; }.public-kpi-grid strong { grid-row:1/3; grid-column:2; color:var(--ops-text); font:700 19px/1 var(--ops-mono); }.public-kpi-grid em { overflow:hidden; color:var(--ops-text-muted); font:8px var(--ops-mono); font-style:normal; letter-spacing:.04em; text-overflow:ellipsis; white-space:nowrap; }.public-kpi-grid .attention strong { color:var(--ops-warning); }.public-status-line { display:flex; justify-content:space-between; gap:8px; margin-top:9px; color:var(--ops-text-muted); font:9px var(--ops-mono); }.public-status-line span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.public-status-line i { display:inline-block; width:7px; height:7px; margin-right:6px; border:1.5px solid var(--ops-warning); transform:rotate(45deg); }
.public-link-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; margin-top:9px; border:1px solid var(--ops-line-soft); background:var(--ops-line-soft); }.public-link-stats span { min-width:0; padding:7px; background:var(--ops-surface-inset); }.public-link-stats small,.public-link-stats strong { display:block; }.public-link-stats small { color:var(--ops-text-muted); font:7px var(--ops-mono); }.public-link-stats strong { margin-top:4px; font:700 11px var(--ops-mono); }
.public-resource-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; margin-top:9px; border:1px solid var(--ops-line-soft); background:var(--ops-line-soft); }.public-resource-grid article { position:relative; min-width:0; padding:7px 8px 8px; overflow:hidden; background:var(--ops-surface-inset); }.public-resource-grid article > div { display:flex; align-items:baseline; justify-content:space-between; gap:5px; }.public-resource-grid small { color:var(--ops-text-muted); font-size:8px; }.public-resource-grid strong { font:700 11px var(--ops-mono); white-space:nowrap; }.public-resource-grid em { margin-left:2px; color:var(--ops-text-muted); font:7px var(--ops-mono); font-style:normal; }.public-resource-grid span { display:block; margin-top:5px; overflow:hidden; color:var(--ops-text-muted); font:7px var(--ops-mono); text-overflow:ellipsis; white-space:nowrap; }.public-resource-grid span i { width:5px; height:5px; display:inline-block; margin-right:5px; background:var(--ops-success); }.public-resource-grid span i.attention { background:var(--ops-warning); clip-path:polygon(50% 0,100% 100%,0 100%); }.public-resource-grid article > b { position:absolute; right:0; bottom:0; left:0; height:2px; display:block; max-width:100%; background:var(--ops-success); }.public-resource-grid article > b.attention { background:var(--ops-warning); }
.public-production-main { display:flex; align-items:end; justify-content:space-between; gap:16px; margin-top:15px; }.public-production-main > div:first-child { min-width:0; }.public-production-main small { color:var(--ops-text-muted); font-size:11px; }.public-production-main strong { display:block; overflow:hidden; margin:5px 0; font-size:17px; text-overflow:ellipsis; white-space:nowrap; }.public-production-main span { color:var(--ops-text-soft); font-size:11px; }.public-progress { flex:0 0 116px; }.public-progress i { display:block; height:5px; overflow:hidden; background:var(--ops-chart-grid); }.public-progress b { display:block; height:100%; background:var(--ops-accent); }.public-progress small { display:block; margin-top:5px; text-align:right; }.public-reading-strip { display:grid; grid-template-columns:repeat(2,1fr); gap:1px; margin-top:14px; overflow:hidden; border:1px solid var(--ops-line-soft); background:var(--ops-line-soft); }.public-reading-strip article { padding:9px; background:var(--ops-surface-inset); }.public-reading-strip small { display:block; color:var(--ops-text-muted); font-size:10px; }.public-reading-strip strong { display:block; margin-top:5px; font:700 16px var(--ops-mono); }.public-reading-strip em { margin-left:3px; color:var(--ops-text-muted); font:9px var(--ops-mono); font-style:normal; }
.public-check-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:1px; margin-top:8px; background:var(--ops-line-soft); }.public-check-grid span { min-width:0; display:grid; grid-template-columns:5px 1fr; gap:3px 5px; align-items:center; padding:6px; background:var(--ops-surface-inset); color:var(--ops-text-muted); font-size:8px; }.public-check-grid i { width:5px; height:5px; background:var(--ops-neutral); }.public-check-grid b { grid-column:2; color:var(--ops-text-soft); font:700 8px var(--ops-mono); }.public-check-grid .normal i { background:var(--ops-success); }.public-check-grid .attention i { background:var(--ops-warning); }.public-check-grid .pending i { background:var(--ops-neutral); }
.public-production-meta { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; margin-top:8px; border:1px solid var(--ops-line-soft); background:var(--ops-line-soft); }.public-production-meta span { min-width:0; padding:7px 8px; background:var(--ops-surface-inset); }.public-production-meta span:last-child { grid-column:1/-1; }.public-production-meta small,.public-production-meta strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.public-production-meta small { color:var(--ops-text-muted); font-size:8px; }.public-production-meta strong { margin-top:4px; color:var(--ops-text-soft); font:700 9px var(--ops-mono); }
.public-alert-summary { display:grid; grid-template-columns:110px minmax(0,1fr); align-items:stretch; gap:10px; margin:10px 0 8px; }.risk-total { display:grid; align-content:center; padding:8px 9px; border-left:2px solid var(--ops-warning); background:var(--ops-surface-inset); }.risk-total small { color:var(--ops-warning); font:700 7px var(--ops-mono); letter-spacing:.06em; }.risk-total strong { margin-top:3px; color:var(--ops-warning); font:700 24px/1 var(--ops-mono); }.risk-total em,.risk-total span { color:var(--ops-text-muted); font-size:8px; font-style:normal; }.risk-total em { margin-top:3px; }.risk-total span { margin-top:6px; }.risk-bars { align-self:center; }.risk-bars p { display:grid; grid-template-columns:58px 1fr 15px; align-items:center; gap:6px; margin:8px 0; color:var(--ops-text-soft); font-size:10px; }.risk-bars p > i { height:4px; overflow:hidden; background:var(--ops-chart-grid); }.risk-bars b { display:block; height:100%; background:var(--ops-info); }.risk-bars .pest b { background:var(--ops-warning); }.risk-bars strong { font:700 10px var(--ops-mono); }.public-risk-breakdown { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1px; margin-bottom:4px; background:var(--ops-line-soft); }.public-risk-breakdown span { min-width:0; padding:6px; color:var(--ops-text-muted); background:var(--ops-surface-inset); font-size:8px; white-space:nowrap; }.public-risk-breakdown i { width:6px; height:6px; display:inline-block; margin-right:4px; background:var(--ops-success); }.public-risk-breakdown .warning i { background:var(--ops-danger); clip-path:polygon(50% 0,100% 100%,0 100%); }.public-risk-breakdown .attention i { background:var(--ops-warning); transform:rotate(45deg); }.public-risk-breakdown strong { float:right; color:var(--ops-text); font:700 9px var(--ops-mono); }.public-alert-list article,.public-device-list article { display:flex; align-items:center; gap:9px; padding:8px 0; border-top:1px solid var(--ops-line-soft); }.public-alert-list article > i { width:7px; height:7px; flex:0 0 7px; border:1.5px solid var(--ops-success); transform:rotate(45deg); }.public-alert-list article > i.warning { border:0; background:var(--ops-danger); clip-path:polygon(50% 0,100% 100%,0 100%); transform:none; }.public-alert-list article > i.attention { border:0; background:var(--ops-warning); clip-path:polygon(50% 0,100% 100%,0 100%); transform:none; }.public-alert-list article div,.public-device-list article div { min-width:0; flex:1; }.public-alert-list strong,.public-device-list strong { display:block; overflow:hidden; font-size:12px; text-overflow:ellipsis; white-space:nowrap; }.public-alert-list small,.public-device-list small { display:block; margin-top:3px; overflow:hidden; color:var(--ops-text-muted); font-size:10px; text-overflow:ellipsis; white-space:nowrap; }.public-alert-list em { color:var(--ops-warning); font-size:10px; font-style:normal; }
.equipment-counts { display:flex; justify-content:space-between; gap:4px; margin:10px 0 3px; }.equipment-counts span { color:var(--ops-text-soft); font-size:8px; white-space:nowrap; }.equipment-counts i { display:inline-block; width:6px; height:6px; margin-right:3px; background:var(--ops-success); }.equipment-counts .standby i { border:1.5px solid var(--ops-neutral); background:transparent; transform:rotate(45deg); }.equipment-counts .charging i { background:var(--ops-info); }.equipment-counts .warning i { background:var(--ops-warning); clip-path:polygon(50% 0,100% 100%,0 100%); }.equipment-counts .offline i { background:var(--ops-danger); }.device-icon { width:29px; height:29px; flex:0 0 29px; display:grid; place-content:center; color:var(--ops-accent); border:1px solid var(--ops-line); background:var(--ops-surface-inset); font:700 11px var(--ops-mono); }.device-icon.machinery-icon { color:var(--ops-info); border-color:oklch(75% .13 235/.36); }.public-device-list em { padding:3px 5px; color:var(--ops-success); border:1px solid var(--ops-line-soft); font-size:10px; font-style:normal; }.public-device-list em.warning { color:var(--ops-warning); }.public-device-list em.offline { color:var(--ops-danger); }.public-device-list em.standby { color:var(--ops-text-muted); }.public-device-list em.charging { color:var(--ops-info); }
.public-machinery-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:1px; margin-top:5px; border:1px solid var(--ops-line-soft); background:var(--ops-line-soft); }.public-machinery-stats span { min-width:0; padding:6px 5px; text-align:center; background:var(--ops-surface-inset); }.public-machinery-stats small,.public-machinery-stats strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.public-machinery-stats small { color:var(--ops-text-muted); font-size:7px; }.public-machinery-stats strong { margin-top:4px; color:var(--ops-accent); font:700 9px var(--ops-mono); }
.public-dashboard-footer { grid-area:footer; display:flex; align-items:center; justify-content:space-between; color:var(--ops-text-muted); font:10px var(--ops-mono); }.public-dashboard-footer span:first-child { color:var(--ops-warning); }
.hud-panel { pointer-events:auto; border:1px solid var(--ops-line); border-radius:var(--ops-radius-md); background:var(--ops-surface); box-shadow:var(--ops-shadow); }
.hud-header { position:absolute; top:16px; left:18px; right:18px; height:68px; display:grid; grid-template-columns:minmax(250px,1fr) auto minmax(440px,1fr); align-items:center; gap:18px; padding:0 18px; }
.brand span,.panel-heading > div > span,.map-context span { color:var(--ops-accent); font:700 10px/1.2 var(--ops-mono); letter-spacing:.12em; }
.brand h1 { margin-top:6px; font-size:24px; font-weight:650; letter-spacing:.035em; }
.active-context { min-width:250px; display:grid; grid-template-columns:auto 1fr; align-items:center; gap:2px 10px; padding:0 16px; border-left:1px solid var(--ops-line-soft); border-right:1px solid var(--ops-line-soft); }.active-context span { grid-column:1/3; color:var(--ops-text-muted); font:700 8px var(--ops-mono); letter-spacing:.12em; }.active-context strong { font-size:14px; }.active-context small { color:var(--ops-text-muted); font-size:10px; white-space:nowrap; }
.system-status { display:flex; align-items:stretch; justify-content:flex-end; gap:6px; }
.fullscreen-toggle { min-width:58px; display:flex; align-items:center; justify-content:center; gap:5px; padding:7px 9px; color:var(--ops-text-muted); border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.58); cursor:pointer; font-size:10px; }.fullscreen-toggle:hover,.fullscreen-toggle.active { color:var(--ops-accent); border-color:var(--ops-line); background:var(--ops-surface-raised); }.fullscreen-toggle:disabled { opacity:.5; cursor:not-allowed; }.fullscreen-toggle i { font:700 15px/1 var(--ops-mono); font-style:normal; }.fullscreen-toggle span { white-space:nowrap; }
.connection-state,.status-meta { min-width:102px; display:flex; align-items:center; gap:9px; padding:7px 10px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:var(--ops-surface-inset); }
.connection-state > span:last-child,.status-meta { flex-direction:column; align-items:flex-start; justify-content:center; gap:3px; }.connection-state > span:last-child { display:flex; }
.system-status small { color:var(--ops-text-muted); font:700 8px/1 var(--ops-mono); letter-spacing:.1em; }
.system-status strong { max-width:150px; overflow:hidden; color:var(--ops-text); font-size:11px; font-weight:650; text-overflow:ellipsis; white-space:nowrap; }
.system-status em { color:var(--ops-text-muted); font:9px/1 var(--ops-font); font-style:normal; white-space:nowrap; }.connection-state.partial em { color:var(--ops-warning); }.connection-state.offline em { color:var(--ops-danger); }
.status-mark { flex:0 0 auto; width:9px; height:9px; border:2px solid var(--ops-neutral); transform:rotate(45deg); }.status-mark.online { border-color:var(--ops-success); border-radius:50%; background:var(--ops-success); transform:none; }.status-mark.partial { border:0; background:var(--ops-warning); clip-path:polygon(50% 0,100% 100%,0 100%); transform:none; }.status-mark.offline { border:0; background:var(--ops-danger); transform:none; }
.telemetry-panel,.event-panel { position:absolute; top:100px; padding:15px; }
.telemetry-panel { left:18px; width:340px; max-height:calc(100vh - 230px); overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; }.event-panel { right:18px; width:328px; max-height:calc(100vh - 218px); }
.panel-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; padding-bottom:11px; border-bottom:1px solid var(--ops-line-soft); }.panel-heading > div > span,.panel-heading > div > strong { display:block; }.panel-heading > div > strong { margin-top:4px; }
.panel-heading strong { font-size:16px; font-weight:650; }.data-freshness { color:var(--ops-text-muted); font:10px var(--ops-mono); font-style:normal; }.data-freshness::before { content:""; display:inline-block; width:7px; height:7px; margin-right:6px; border:1.5px solid var(--ops-neutral); transform:rotate(45deg); }.data-freshness.ready::before { border:0; border-radius:50%; background:var(--ops-success); transform:none; }.data-freshness.stale { color:var(--ops-warning); }.data-freshness.stale::before { border:0; border-radius:0; background:var(--ops-warning); clip-path:polygon(50% 0,100% 100%,0 100%); transform:none; }
.event-heading-actions { display:flex; align-items:center; gap:7px; }.attention-count { padding:4px 6px; color:var(--ops-warning); border:1px solid oklch(80% .13 75/.3); border-radius:var(--ops-radius-sm); font-size:9px; }.event-count { color:var(--ops-accent); font:700 10px var(--ops-mono); font-style:normal; }.event-toggle { width:34px; height:34px; display:grid; place-items:center; padding:0; color:var(--ops-accent); border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:transparent; cursor:pointer; font:700 18px/1 var(--ops-mono); }.event-toggle:hover { color:var(--ops-text); border-color:var(--ops-line); background:var(--ops-surface-raised); }.event-panel.collapsed { width:auto; min-width:118px; max-height:none; }.event-panel.collapsed .panel-heading { padding-bottom:0; border-bottom:0; }.event-panel.collapsed .panel-heading > div:first-child { display:none; }.event-panel.collapsed .event-count::before { content:"事件 "; color:var(--ops-text-muted); font:10px var(--ops-font); }
.reading-grid { display:grid; grid-template-columns:1fr; gap:1px; margin-top:12px; overflow:hidden; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:var(--ops-line-soft); }
.telemetry-panel > p { margin-top:11px; color:var(--ops-text-muted); font-size:11px; }
.production-detail { margin-top:12px; padding:10px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.64); }.production-detail-heading,.production-profile-main,.production-meta,.production-progress > div { display:flex; align-items:center; justify-content:space-between; gap:8px; }.production-detail-heading span { color:var(--ops-accent); font:700 8px var(--ops-mono); letter-spacing:.1em; }.production-detail-heading small { color:var(--ops-text-muted); font-size:9px; }.production-profile-main { margin-top:8px; }.production-profile-main strong { overflow:hidden; font-size:13px; text-overflow:ellipsis; white-space:nowrap; }.production-profile-main em { flex:0 0 auto; padding:3px 6px; color:var(--ops-warning); border:1px solid oklch(80% .13 75/.3); border-radius:3px; font-size:9px; font-style:normal; }.production-meta { margin-top:8px; color:var(--ops-text-muted); font-size:9px; }.production-meta strong { margin-left:3px; color:var(--ops-text); font:10px var(--ops-mono); }.production-progress { margin-top:10px; }.production-progress > div { color:var(--ops-text-muted); font-size:9px; }.production-progress > div strong { color:var(--ops-accent); font:700 10px var(--ops-mono); }.production-progress > i { display:block; height:4px; margin-top:5px; overflow:hidden; border-radius:2px; background:var(--ops-line-soft); }.production-progress > i b { display:block; height:100%; border-radius:inherit; background:var(--ops-accent); }.production-checks { display:grid; grid-template-columns:repeat(5,1fr); gap:3px; margin-top:10px; }.production-checks article { min-width:0; padding:6px 3px; text-align:center; border:1px solid var(--ops-line-soft); border-radius:3px; }.production-checks i,.production-health i { display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--ops-text-muted); }.production-checks span,.production-checks strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.production-checks span { margin-top:4px; color:var(--ops-text-muted); font-size:8px; }.production-checks strong { margin-top:3px; font:700 8px var(--ops-mono); }.production-checks article.normal i,.production-health i.normal { background:var(--ops-success); }.production-checks article.normal strong { color:var(--ops-success); }.production-checks article.attention i,.production-health i.attention { background:var(--ops-warning); }.production-checks article.attention strong { color:var(--ops-warning); }.production-health { display:flex; align-items:center; gap:5px; margin-top:8px; color:var(--ops-text-muted); font-size:9px; }.production-health i.pending { background:var(--ops-text-muted); }.pest-warning { margin-top:9px; padding-top:8px; border-top:1px solid var(--ops-line-soft); }.pest-heading,.pest-main { display:flex; align-items:center; justify-content:space-between; gap:8px; }.pest-heading span { color:var(--ops-accent); font:700 8px var(--ops-mono); letter-spacing:.1em; }.pest-heading em { padding:2px 5px; color:var(--ops-text-muted); border:1px solid var(--ops-line-soft); border-radius:3px; font-size:8px; font-style:normal; }.pest-heading em.attention { color:var(--ops-warning); border-color:oklch(80% .13 75/.3); }.pest-heading em.warning { color:var(--ops-danger); border-color:oklch(64% .2 25/.35); }.pest-main { margin-top:5px; }.pest-main strong { font-size:12px; }.pest-main span,.pest-warning p,.pest-warning small { color:var(--ops-text-muted); font-size:8px; }.pest-warning p { margin:4px 0 0; }.pest-warning small { display:block; margin-top:3px; line-height:1.4; }.pest-warning .pest-disclaimer { color:var(--ops-warning); }
.event-list { max-height:calc(100vh - 292px); overflow:auto; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; }
.event-list article { position:relative; display:grid; grid-template-columns:58px 1fr; gap:6px 9px; padding:11px 2px 11px 16px; border-bottom:1px solid var(--ops-line-soft); }.event-list article::before { content:""; position:absolute; top:15px; left:2px; width:7px; height:7px; border:1.5px solid var(--ops-info); transform:rotate(45deg); }.event-list article[class*="online"]::before,.event-list article[class*="ready"]::before { border-color:var(--ops-success); border-radius:50%; background:var(--ops-success); transform:none; }.event-list article[class*="alert"]::before,.event-list article[class*="warning"]::before { border:0; background:var(--ops-warning); clip-path:polygon(50% 0,100% 100%,0 100%); transform:none; }.event-list article[class*="error"]::before,.event-list article[class*="failed"]::before,.event-list article[class*="blocked"]::before { border:0; background:var(--ops-danger); transform:none; }.event-list article:last-child { border-bottom:0; }
.event-list time { color:var(--ops-text-muted); font:10px var(--ops-mono); font-variant-numeric:tabular-nums; }.event-list strong { color:var(--ops-accent); font:700 10px var(--ops-mono); letter-spacing:.04em; }
.event-list article[class*="alert"] strong,.event-list article[class*="warning"] strong { color:var(--ops-warning); }.event-list article[class*="error"] strong,.event-list article[class*="failed"] strong,.event-list article[class*="blocked"] strong { color:var(--ops-danger); }.event-list p { grid-column:1/3; margin:0; color:var(--ops-text-soft); font-size:12px; line-height:1.5; }.empty { color:var(--ops-text-muted); text-align:center; }
.map-context { position:absolute; top:100px; left:50%; width:min(380px,calc(100vw - 760px)); min-width:300px; display:grid; grid-template-columns:1fr auto; gap:5px 14px; padding:10px 12px; transform:translateX(-50%); }.map-context > div span,.map-context > div strong { display:block; }.map-context > div strong { margin-top:3px; font-size:13px; }.map-context > p { align-self:center; margin:0; color:var(--ops-text-soft); font:10px var(--ops-mono); }.map-context ul { grid-column:1/3; display:flex; gap:14px; padding-top:7px; border-top:1px solid var(--ops-line-soft); }.map-context li { display:flex; align-items:center; gap:6px; color:var(--ops-text-muted); font-size:10px; }.map-context li i { width:8px; height:8px; border:1.5px solid var(--ops-neutral); transform:rotate(45deg); }.map-context li i.normal { border-color:var(--ops-success); border-radius:50%; background:var(--ops-success); transform:none; }.map-context li i.warning { border:0; background:var(--ops-warning); clip-path:polygon(50% 0,100% 100%,0 100%); transform:none; }.map-context li i.danger { border:0; background:var(--ops-danger); transform:none; }.map-context li i.crop { border:0; background:oklch(67% .1 145); transform:none; }.map-context li i.water { border-radius:50%; border-color:var(--ops-info); background:oklch(75% .13 235/.18); transform:none; }
.topic-bar { position:absolute; left:50%; bottom:74px; max-width:calc(100vw - 36px); display:flex; gap:4px; padding:5px; transform:translateX(-50%); overflow-x:auto; scrollbar-width:none; }
.topic-bar.has-attachments { bottom:143px; }
.topic-bar::-webkit-scrollbar { display:none; }
.topic-bar button,.command-bar button,.map-tools button { min-height:36px; flex:0 0 auto; padding:8px 12px; color:var(--ops-text-muted); border:1px solid transparent; border-radius:var(--ops-radius-sm); background:transparent; cursor:pointer; white-space:nowrap; transition:color var(--ops-ease),background var(--ops-ease),border-color var(--ops-ease); }
.topic-bar button:hover { color:var(--ops-text); background:var(--ops-surface-raised); }.topic-bar button.active { color:var(--ops-canvas); background:var(--ops-accent); font-weight:700; }
.topic-bar button:disabled,.map-tools button:disabled { opacity:.42; cursor:not-allowed; }
.map-tools { position:absolute; right:62px; bottom:74px; display:flex; gap:2px; padding:5px; }.map-tools button { display:flex; align-items:center; gap:5px; padding:7px 9px; }.map-tools button:hover,.map-tools button.active { color:var(--ops-text); border-color:var(--ops-line); background:var(--ops-surface-raised); }.map-tools button.active { color:var(--ops-accent); }.map-tools i { width:15px; color:inherit; font:700 14px var(--ops-mono); text-align:center; font-style:normal; }.map-tools span { font-size:10px; }
.map-tools.has-attachments { bottom:199px; }
.command-bar { position:absolute; left:50%; bottom:16px; width:min(820px,calc(100vw - 36px)); padding:4px; transform:translateX(-50%); }
.command-main { height:46px; display:flex; align-items:center; }.agent-picker { align-self:stretch; min-width:138px; display:grid; grid-template-columns:auto 1fr; align-items:center; gap:7px; padding:0 10px; border-right:1px solid var(--ops-line-soft); }.agent-picker > span { color:var(--ops-accent); font:700 8px var(--ops-mono); letter-spacing:.08em; }.agent-picker select { min-width:0; height:32px; padding:0 22px 0 7px; color:var(--ops-text); border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); outline:0; background:var(--ops-surface-raised); font-size:11px; cursor:pointer; }.agent-picker option { color:#e7f4f3; background:#08212b; }
.command-main > input:not(.file-input) { flex:1; min-width:0; height:100%; padding:0 12px; color:var(--ops-text); border:0; outline:0; background:transparent; font-size:13px; }.command-main > input::placeholder { color:var(--ops-text-muted); }.file-input { position:absolute; width:1px; height:1px; overflow:hidden; opacity:0; pointer-events:none; }.command-main kbd { padding:4px 6px; color:var(--ops-text-muted); border:1px solid var(--ops-line-soft); border-radius:3px; font:8px var(--ops-mono); }.command-main > button { height:36px; margin-left:7px; padding:0 18px; color:var(--ops-canvas); border:1px solid transparent; border-radius:var(--ops-radius-sm); background:var(--ops-accent); font-weight:700; cursor:pointer; }.command-main > button:hover { background:var(--ops-accent-strong); }.command-main .attach-button { width:36px; flex:0 0 36px; padding:0; color:var(--ops-accent); border-color:var(--ops-line); background:transparent; font:700 20px var(--ops-mono); }.command-main .attach-button:hover { color:var(--ops-text); background:var(--ops-surface-raised); }
.agent-picker select:focus-visible,.command-main > input:not(.file-input):focus-visible { outline:2px solid var(--ops-accent); outline-offset:2px; box-shadow:0 0 0 4px var(--ops-focus-ring); }
.attachment-strip { display:flex; align-items:center; gap:6px; margin-bottom:4px; padding:6px; overflow-x:auto; border-bottom:1px solid var(--ops-line-soft); scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; }.local-only { flex:0 0 auto; padding:4px 6px; color:var(--ops-warning); border:1px solid oklch(80% .13 75/.3); border-radius:var(--ops-radius-sm); font:700 8px var(--ops-mono); }.attachment-chip { min-width:0; max-width:220px; flex:0 0 auto; display:grid; grid-template-columns:28px minmax(60px,1fr) auto 24px; align-items:center; gap:6px; padding:4px 5px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:var(--ops-surface-raised); }.attachment-chip > img,.attachment-chip > span { width:28px; height:28px; object-fit:cover; display:grid; place-items:center; color:var(--ops-accent); border-radius:3px; background:oklch(16% .025 225/.8); font:700 7px var(--ops-mono); }.attachment-chip strong { overflow:hidden; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }.attachment-chip small { color:var(--ops-text-muted); font:8px var(--ops-mono); }.attachment-chip button { width:24px; height:24px; padding:0; color:var(--ops-text-muted); border:0; background:transparent; cursor:pointer; font-size:16px; }.attachment-chip button:hover { color:var(--ops-danger); }.file-error { align-self:center; flex:0 0 auto; color:var(--ops-danger); font-size:9px; font-style:normal; }
.map-notice { position:absolute; left:50%; top:50%; width:min(480px,calc(100vw - 36px)); padding:22px; text-align:center; transform:translate(-50%,-50%); }.map-notice strong { font-size:18px; font-weight:650; }.map-notice p { margin:10px 0; color:var(--ops-warning); line-height:1.5; }.map-notice small { color:var(--ops-text-muted); }
.production-detail-heading span,.pest-heading span { font-size:10px; }.production-detail-heading small,.production-meta,.production-health,.pest-main span,.pest-warning p,.pest-warning small { font-size:10px; line-height:1.45; }.production-checks span,.production-checks strong { font-size:9px; }.local-only,.file-error { font-size:10px; }
@media (max-width:1100px) { .active-context,.map-context,.status-meta-secondary { display:none; }.hud-header { grid-template-columns:1fr auto; }.event-panel { display:none; }.topic-bar { left:18px; right:18px; width:auto; max-width:none; transform:none; }.map-tools { right:18px; bottom:126px; }.map-tools.has-attachments { bottom:199px; } }
@media (min-width:601px) { .farmclaw-hud.has-attachments :deep(.telemetry-panel),.farmclaw-hud.has-attachments :deep(.security-panel),.farmclaw-hud.has-attachments :deep(.ai-managed-panel),.farmclaw-hud.has-attachments :deep(.value-panel),.farmclaw-hud.has-attachments :deep(.operations-panel),.farmclaw-hud.has-attachments :deep(.alert-center-panel) { max-height:calc(100vh - 299px); } }
@media (max-width:900px) { .telemetry-panel { width:300px; }.topic-bar { left:18px; right:18px; width:auto; max-width:none; transform:none; }.map-tools { right:18px; bottom:126px; }.map-tools.has-attachments { bottom:199px; } }
@media (max-width:900px) { .public-dashboard-header { height:82px; padding:0 16px; }.public-dashboard-header h1 { font-size:20px; }.public-dashboard-header p { display:none; }.public-header-right { gap:7px; }.public-live { padding:7px; font-size:10px; }.public-clock { display:none; }.public-exit { min-height:40px; padding:0 10px; font-size:11px; }.public-dashboard-grid { inset:96px 12px 12px; display:flex; flex-direction:column; gap:10px; overflow-y:auto; padding-bottom:10px; pointer-events:auto; }.public-panel { flex:0 0 auto; min-height:0; overflow:visible; }.public-dashboard-footer { flex:0 0 auto; min-height:36px; display:block; line-height:1.5; }.public-dashboard-footer span { display:block; } }
/* 旧版移动上限 max-height:calc(100vh - 210px) 已收敛为 34vh，确保地图保持主工作区。 */
@media (max-width:600px) { .hud-header { top:10px; left:10px; right:10px; height:78px; grid-template-columns:1fr auto; gap:8px; padding:0 12px; }.brand span { font-size:9px; }.brand h1 { font-size:19px; }.system-status { gap:5px; }.connection-state { min-width:auto; padding:7px 8px; }.connection-state small,.connection-state em { display:none; }.connection-state strong { font-size:10px; }.fullscreen-toggle { min-width:44px; width:44px; min-height:44px; padding:7px 4px; }.fullscreen-toggle span { display:none; }.status-meta { display:none!important; }.telemetry-panel { top:auto; bottom:126px; left:10px; right:10px; width:auto; height:34vh; max-height:34vh; padding:12px; overflow-y:auto; border-radius:8px; }.telemetry-panel::before { content:""; display:block; width:36px; height:3px; margin:-5px auto 7px; border-radius:3px; background:var(--ops-line); }.reading-grid { grid-template-columns:repeat(5,minmax(128px,1fr)); overflow-x:auto; }.production-detail { margin-top:9px; padding:9px; }.production-checks { gap:2px; }.production-checks article { padding:5px 2px; }.topic-bar { left:10px; right:10px; bottom:70px; max-width:none; scroll-snap-type:x proximity; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; }.topic-bar.has-attachments { bottom:138px; }.topic-bar button { min-width:82px; min-height:44px; scroll-snap-align:start; }.topic-bar::after { content:"→"; position:sticky; right:0; min-width:24px; display:grid; place-items:center; color:var(--ops-text-muted); background:var(--ops-surface); }.map-tools,.map-tools.context-open { top:190px; right:10px; bottom:auto; left:auto; flex-direction:row; }.map-tools.has-attachments { bottom:auto; }.map-tools.context-open button:not(.satellite-toggle) { display:none; }.map-tools button { width:44px; min-height:44px; padding:0; justify-content:center; }.map-tools button span { display:none; }.command-bar { bottom:10px; width:calc(100vw - 20px); }.command-main { height:48px; }.agent-picker { min-width:86px; width:86px; display:block; padding:4px; }.agent-picker > span { display:none; }.agent-picker select { width:100%; height:40px; padding:0 4px; font-size:10px; }.command-main > input:not(.file-input) { padding:0 7px; font-size:11px; }.command-main kbd { display:none; }.command-main > button { min-width:54px; min-height:40px; padding:0 10px; }.command-main .attach-button { min-width:40px; width:40px; flex-basis:40px; }.attachment-strip { max-height:58px; }.attachment-chip { max-width:175px; grid-template-columns:26px minmax(50px,1fr) 24px; }.attachment-chip small { display:none; }.attachment-chip > img,.attachment-chip > span { width:26px; height:26px; } }
.context-scale { grid-column:1/3; display:flex; align-items:center; gap:7px; color:var(--ops-text-muted); font:9px var(--ops-mono); }.context-scale i { height:4px; flex:1; min-width:20px; border-radius:1px; background:linear-gradient(90deg,var(--ops-info),var(--ops-accent),var(--ops-success)); }.context-scale i:nth-of-type(2) { background:linear-gradient(90deg,var(--ops-warning),var(--ops-danger)); }.risk-scale i:first-of-type { background:linear-gradient(90deg,var(--ops-info),var(--ops-warning)); }.risk-scale i:last-of-type { background:linear-gradient(90deg,var(--ops-warning),var(--ops-danger)); }
.mobile-panel-toggle { display:none; min-height:30px; padding:4px 7px; color:var(--ops-accent); border:1px solid var(--ops-line); border-radius:var(--ops-radius-sm); background:var(--ops-surface-inset); cursor:pointer; font-size:10px; white-space:nowrap; }.mobile-panel-toggle:hover { color:var(--ops-text); background:var(--ops-surface-raised); }
@media (max-width:600px) { .map-context { top:92px; left:10px; right:72px; width:auto; min-width:0; display:grid; padding:8px 10px; transform:none; }.map-context > p { font-size:9px; }.map-context ul { gap:8px; }.map-context li { font-size:9px; }.context-scale { font-size:8px; }.mobile-panel-toggle { min-height:44px; display:block; grid-column:2; grid-row:1; justify-self:end; }.farmclaw-hud.mobile-panel-expanded .map-tools { display:none; }.farmclaw-hud.mobile-panel-expanded :deep(.telemetry-panel),.farmclaw-hud.mobile-panel-expanded :deep(.security-panel),.farmclaw-hud.mobile-panel-expanded :deep(.ai-managed-panel),.farmclaw-hud.mobile-panel-expanded :deep(.value-panel),.farmclaw-hud.mobile-panel-expanded :deep(.operations-panel),.farmclaw-hud.mobile-panel-expanded :deep(.alert-center-panel) { height:clamp(32vh,calc(100vh - 313px),58vh); max-height:clamp(32vh,calc(100vh - 313px),58vh); } }
@media (max-width:600px) { .farmclaw-hud.has-attachments .map-tools { display:none; }.farmclaw-hud.has-attachments .map-context { left:auto; right:10px; width:auto; display:block; padding:0; border:0; background:transparent; box-shadow:none; }.farmclaw-hud.has-attachments .map-context > :not(.mobile-panel-toggle) { display:none; }.farmclaw-hud.has-attachments :deep(.telemetry-panel),.farmclaw-hud.has-attachments :deep(.security-panel),.farmclaw-hud.has-attachments :deep(.ai-managed-panel),.farmclaw-hud.has-attachments :deep(.value-panel),.farmclaw-hud.has-attachments :deep(.operations-panel),.farmclaw-hud.has-attachments :deep(.alert-center-panel) { bottom:202px; }.farmclaw-hud.has-attachments.mobile-panel-expanded :deep(.telemetry-panel),.farmclaw-hud.has-attachments.mobile-panel-expanded :deep(.security-panel),.farmclaw-hud.has-attachments.mobile-panel-expanded :deep(.ai-managed-panel),.farmclaw-hud.has-attachments.mobile-panel-expanded :deep(.value-panel),.farmclaw-hud.has-attachments.mobile-panel-expanded :deep(.operations-panel),.farmclaw-hud.has-attachments.mobile-panel-expanded :deep(.alert-center-panel) { height:clamp(32vh,calc(100vh - 403px),58vh); max-height:clamp(32vh,calc(100vh - 403px),58vh); } }
@media (max-width:320px) { .farmclaw-hud.mobile-panel-expanded .map-context { left:auto; right:10px; width:auto; display:block; padding:0; border:0; background:transparent; box-shadow:none; }.farmclaw-hud.mobile-panel-expanded .map-context > :not(.mobile-panel-toggle) { display:none; } }

/*
 * 大屏自适应：以视口比例驱动展示屏的边距、侧栏和间距，避免在 1024px
 * 等中等宽度下三列固定宽度把右侧面板推出画布。地图仍是底层主视觉，
 * 面板只在内容确实超出时内部滚动。
 */
.farmclaw-hud {
  --hud-safe-top: env(safe-area-inset-top, 0px);
  --hud-safe-right: env(safe-area-inset-right, 0px);
  --hud-safe-bottom: env(safe-area-inset-bottom, 0px);
  --hud-safe-left: env(safe-area-inset-left, 0px);
  --public-gutter: clamp(12px, 1.75vw, 34px);
  --public-header-h: clamp(74px, 8.4vh, 104px);
  --public-gap: clamp(10px, 1.05vw, 20px);
  --public-side: clamp(320px, 19vw, 410px);
  --public-panel-pad: clamp(12px, .95vw, 20px);
}

.public-dashboard-header {
  top: var(--hud-safe-top);
  height: var(--public-header-h);
  padding-inline: max(var(--public-gutter), var(--hud-safe-left)) max(var(--public-gutter), var(--hud-safe-right));
}

.public-dashboard-grid {
  inset: calc(var(--public-header-h) + var(--hud-safe-top) + clamp(12px, 1.6vh, 20px)) max(var(--public-gutter), var(--hud-safe-left)) calc(12px + var(--hud-safe-bottom)) max(var(--public-gutter), var(--hud-safe-right));
  grid-template-columns: minmax(0, var(--public-side)) minmax(300px, 1fr) minmax(0, var(--public-side));
  grid-template-rows: minmax(0, .94fr) minmax(0, 1.06fr) auto;
  gap: var(--public-gap);
}

.public-panel {
  padding: var(--public-panel-pad);
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--ops-line) transparent;
}

.public-panel-title strong { font-size: clamp(14px, 1.05vw, 18px); }
.public-panel-title span { font-size: clamp(8px, .58vw, 11px); }
.public-kpi-grid strong { font-size: clamp(18px, 1.25vw, 24px); }
.public-reading-strip strong { font-size: clamp(15px, 1.05vw, 19px); }
.public-device-list .device-icon { border-radius: 3px; }

.map-tools .tabler-icon,
.fullscreen-toggle .tabler-icon,
.event-toggle .tabler-icon,
.attach-button .tabler-icon,
.command-main > button .tabler-icon,
.attachment-chip button .tabler-icon,
.topic-scroll-hint .tabler-icon,
.device-icon .tabler-icon { width: 1em; height: 1em; }

.map-tools .tabler-icon { width: 16px; height: 16px; }
.fullscreen-toggle .tabler-icon { width: 16px; height: 16px; }
.event-toggle { display: grid; place-items: center; }
.command-main > button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.attachment-file-icon { display: grid !important; place-items: center; }
.attachment-file-icon .tabler-icon { width: 15px; height: 15px; }
.attachment-chip button { display: grid; place-items: center; }

@media (max-width: 1180px) and (min-width: 901px) {
  .public-dashboard-header { padding-inline: 18px; }
  .public-dashboard-header p { display: none; }
  .public-map-overlay { display: none; }
  .public-dashboard-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas: "kpis alerts" "production equipment" "footer footer";
    grid-template-rows: minmax(0, .96fr) minmax(0, 1.04fr) auto;
  }
  .public-panel { min-width: 0; }
  .public-production-main { gap: 10px; }
  .public-progress { flex-basis: clamp(92px, 12vw, 132px); }
}

@media (max-height: 720px) and (min-width: 901px) {
  .public-dashboard-header { --public-header-h: 74px; height: 74px; }
  .public-dashboard-grid {
    inset: 84px 18px calc(8px + var(--hud-safe-bottom));
    gap: 10px;
    grid-template-rows: minmax(0, .96fr) minmax(0, 1.04fr) 20px;
  }
  .public-panel { padding: 11px 12px; }
  .public-panel-title { padding-bottom: 7px; }
  .public-panel-title span { margin-bottom: 2px; font-size: 8px; }
  .public-panel-title strong { font-size: 14px; }
  .public-kpi-grid article { min-height: 34px; padding: 5px 2px; }
  .public-kpi-grid small,.public-production-main small,.public-production-main span { font-size: 10px; }
  .public-alert-summary { grid-template-columns: 92px minmax(0, 1fr); margin: 6px 0; }
  .risk-total { padding: 5px 7px; }
  .risk-total strong { font-size: 20px; }
  .public-reading-strip { margin-top: 9px; }
  .public-reading-strip article { padding: 7px; }
  .public-map-overlay { gap: 7px; padding-top: 3px; }
  .public-map-overlay-head { padding-block: 6px; }
  .public-map-overlay-meta > span { padding-block: 4px; }
  .public-map-telemetry article { padding: 5px 6px; }
  .public-map-event { min-height: 28px; padding-block: 4px; }
  .public-link-stats,.public-check-grid,.public-production-meta,.public-risk-breakdown,.public-machinery-stats { display: none; }
  .public-resource-grid { margin-top: 6px; }
  .public-resource-grid article { padding: 5px 6px 6px; }
  .public-device-list article { padding: 6px 0; }
  .public-dashboard-footer { font-size: 9px; }
}

@media (max-width: 900px) {
  .public-map-overlay { display: none; }
  .public-dashboard-header {
    height: clamp(70px, 14vh, 84px);
    padding-inline: max(12px, var(--hud-safe-left)) max(12px, var(--hud-safe-right));
  }
  .public-dashboard-grid {
    inset: calc(clamp(70px, 14vh, 84px) + 10px) 12px calc(10px + var(--hud-safe-bottom));
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    padding-bottom: 6px;
  }
  .public-panel {
    flex: 0 0 auto;
    min-height: clamp(214px, 32vh, 300px);
    overflow: visible;
  }
  .public-dashboard-footer { flex: 0 0 auto; min-height: 34px; display: block; line-height: 1.45; }
  .public-dashboard-footer span { display: block; }
}

@media (max-width: 600px) {
  .public-dashboard-header { height: 94px; display: block; padding: 11px max(10px, var(--hud-safe-right)) 8px max(10px, var(--hud-safe-left)); }
  .public-dashboard-header > div:first-child { min-width: 0; }
  .public-kicker { display: block; max-width: 100%; overflow: hidden; font-size: 8px; letter-spacing: .1em; text-overflow: ellipsis; white-space: nowrap; }
  .public-dashboard-header h1 { font-size: clamp(19px, 5.3vw, 23px); }
  .public-dashboard-header h1 { margin-top: 4px; white-space: nowrap; }
  .public-header-right { position: absolute; right: max(10px, var(--hud-safe-right)); bottom: 8px; left: max(10px, var(--hud-safe-left)); justify-content: space-between; }
  .public-live { flex: 1 1 auto; max-width: none; }
  .public-dashboard-grid { inset: 104px 10px calc(8px + var(--hud-safe-bottom)); gap: 8px; }
  .public-panel { min-height: clamp(208px, 30vh, 278px); padding: 11px; }
  .public-kpi-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin-top: 8px; background: var(--ops-line-soft); }
  .public-kpi-grid article { min-height: 54px; padding: 7px; background: var(--ops-surface-inset); border-bottom: 0; }
  .public-kpi-grid small { font-size: 10px; }
  .public-kpi-grid strong { font-size: 18px; }
  .public-kpi-grid em { font-size: 8px; }
  .public-production-main { margin-top: 10px; gap: 8px; }
  .public-production-main strong { font-size: 15px; }
  .public-progress { flex-basis: 92px; }
  .public-alert-summary { grid-template-columns: 92px minmax(0, 1fr); gap: 8px; margin: 9px 0; }
  .risk-total { padding: 6px 7px; }
  .risk-total strong { font-size: 19px; }
  .risk-bars p { grid-template-columns: 56px 1fr 14px; gap: 5px; font-size: 10px; }
  .equipment-counts { flex-wrap: wrap; justify-content: flex-start; gap: 5px 10px; }
  .public-device-list article { padding: 7px 0; }
  .public-dashboard-footer { font-size: 9px; }
  .public-clock { display: none; }
  .public-header-right { gap: 6px; }
  .public-live { max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 7px 8px; font-size: 9px; }
  .public-exit { min-height: 40px; padding-inline: 9px; font-size: 10px; }
  .topic-bar::after { content: none; }
  .topic-scroll-hint { position: sticky; right: 0; display: grid; place-items: center; min-width: 28px; min-height: 44px; color: var(--ops-text-muted); background: var(--ops-surface); }
}

@media (min-width: 601px) {
  .topic-scroll-hint { display: none; }
}
</style>
<style src="@/style/workspace.css"></style>
