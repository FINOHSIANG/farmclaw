<script setup>
import { computed, nextTick, ref } from 'vue'
import TablerIcon from '@/components/TablerIcon.vue'
import { facilityIconDataUri } from '@/utils/facilityIcons.js'

const props = defineProps({
  state: {
    type: Object,
    default: () => ({ fences: [], cameras: [], armedCount: 0, onlineCount: 0, alertCount: 0, fencesVisible: true, camerasVisible: true })
  },
  selected: { type: Object, default: null }
})

const emit = defineEmits(['action'])
const activeTab = ref('cameras')
const panelRoot = ref(null)
const confirmDisarmAll = ref(false)
const disarmConfirmButton = ref(null)
const disarmTriggerButton = ref(null)
const disarmReturnTarget = ref(null)
const priority = { alarm: 0, offline: 1, maintenance: 2, disarmed: 3, armed: 4, online: 5 }
const sortByPriority = (items) => [...items].sort((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9) || a.name.localeCompare(b.name, 'zh-CN'))
const fences = computed(() => sortByPriority(props.state.fences || []))
const cameras = computed(() => sortByPriority(props.state.cameras || []))

function hasActiveAlert(item) {
  return item?.status === 'alarm' || Number(item?.incidents) > 0
}

function action(type, payload = {}) {
  emit('action', { type, ...payload })
}

async function requestDisarmAll(event) {
  disarmTriggerButton.value = event?.currentTarget || null
  disarmReturnTarget.value = event?.currentTarget?.closest('.arm-actions') || null
  confirmDisarmAll.value = true
  await nextTick()
  disarmConfirmButton.value?.focus()
}

async function closeDisarmAll(performAction = false) {
  const returnTarget = disarmReturnTarget.value
  const triggerButton = disarmTriggerButton.value
  if (performAction) action('disarm-all')
  confirmDisarmAll.value = false
  await nextTick()
  const restoredTrigger = returnTarget?.querySelector('.danger-secondary')
  if (restoredTrigger?.isConnected) restoredTrigger.focus()
  else if (returnTarget?.isConnected) returnTarget.focus()
  else if (triggerButton?.isConnected) triggerButton.focus()
  else if (panelRoot.value?.isConnected) panelRoot.value.focus()
  disarmReturnTarget.value = null
  disarmTriggerButton.value = null
}

function statusLabel(status) {
  return {
    armed: '已布防',
    disarmed: '已撤防',
    alarm: '告警',
    online: '在线',
    offline: '离线',
    maintenance: '维护中'
  }[status] || status
}

function itemStatusLabel(item) {
  if (hasActiveAlert(item) && item?.controlStatus === 'disarmed') return '告警待确认 · 已撤防'
  return statusLabel(item?.status)
}
</script>

<template>
  <aside ref="panelRoot" class="security-panel" tabindex="-1" aria-label="安防态势">
    <header>
      <div class="workspace-panel-title">
        <TablerIcon name="shield-check" :size="19" aria-hidden="true" />
        <div>
        <span>SECURITY / FIELD PERIMETER</span>
        <h2>安防态势</h2>
        </div>
      </div>
      <em :class="{ alert: state.alertCount > 0 }">{{ state.alertCount }} 个演示告警</em>
    </header>

    <p class="simulation-notice" role="note">
      <TablerIcon name="shield-check" :size="16" aria-hidden="true" />
      <span class="simulation-copy"><strong>本地数字孪生演示</strong><span>状态与操作仅保存在本页面，不控制现场围栏、摄像头或其他设备。</span></span>
    </p>

    <section class="security-stats">
      <article><strong>{{ state.armedCount }}/{{ fences.length }}</strong><small>模拟围栏布防</small></article>
      <article><strong>{{ state.onlineCount }}/{{ cameras.length }}</strong><small>演示摄像头在线</small></article>
      <article><strong>{{ cameras.filter((item) => item.status === 'offline' || item.status === 'maintenance').length }}</strong><small>演示异常设备</small></article>
    </section>

    <nav class="security-tabs" aria-label="安防类型">
      <button :class="{ active: activeTab === 'cameras' }" :aria-pressed="activeTab === 'cameras'" type="button" @click="activeTab = 'cameras'">摄像头点位</button>
      <button :class="{ active: activeTab === 'fences' }" :aria-pressed="activeTab === 'fences'" type="button" @click="activeTab = 'fences'">电子围栏</button>
    </nav>

    <section v-if="activeTab === 'cameras'" class="security-section">
      <div class="section-actions">
        <span>点位 {{ cameras.length }}</span>
        <button type="button" @click="action('toggle-cameras', { visible: !state.camerasVisible })">
          {{ state.camerasVisible ? '隐藏点位' : '显示点位' }}
        </button>
      </div>
      <div class="security-list">
        <article
          v-for="camera in cameras"
          :key="camera.id"
          :class="['security-row', camera.status, { selected: selected?.id === camera.id }]"
        >
          <button class="row-main camera-row-main" type="button" @click="action('focus', { featureId: camera.id })">
            <img :src="facilityIconDataUri('camera')" alt="" />
            <span><strong>{{ camera.name }}</strong><small>{{ camera.zone }} · {{ camera.type === 'ptz' ? '云台' : '定焦' }}</small></span>
            <em>{{ itemStatusLabel(camera) }}</em>
          </button>
          <button
            v-if="hasActiveAlert(camera)"
            class="ack-button"
            type="button"
            :aria-label="`确认 ${camera.name} 的本地演示告警`"
            @click="action('ack', { featureId: camera.id })"
          >确认告警</button>
        </article>
      </div>
    </section>

    <section v-else class="security-section">
      <div class="section-actions">
        <span>围栏 {{ fences.length }}</span>
        <button type="button" @click="action('toggle-fences', { visible: !state.fencesVisible })">
          {{ state.fencesVisible ? '隐藏围栏' : '显示围栏' }}
        </button>
      </div>
      <div ref="disarmReturnTarget" class="arm-actions" tabindex="-1">
        <button type="button" @click="action('arm-all')">模拟全部布防</button>
        <template v-if="!confirmDisarmAll">
          <button class="danger-secondary" type="button" @click="requestDisarmAll($event)">模拟全部撤防</button>
        </template>
        <div v-else class="disarm-confirm" role="alert">
          <span>将把 {{ fences.length }} 个围栏的本地演示状态设为撤防；未确认告警仍会保留，不控制现场设备。</span>
          <button ref="disarmConfirmButton" type="button" @click="closeDisarmAll(true)">确认本地撤防</button>
          <button type="button" @click="closeDisarmAll(false)">取消</button>
        </div>
      </div>
      <div class="security-list fence-list">
        <article
          v-for="fence in fences"
          :key="fence.id"
          :class="['security-row', fence.status, { selected: selected?.id === fence.id }]"
        >
          <button class="row-main" type="button" @click="action('focus', { featureId: fence.id })">
            <img class="fence-glyph" :src="facilityIconDataUri('fence')" alt="" />
            <span><strong>{{ fence.name }}</strong><small>{{ fence.zone }} · {{ fence.rule }}</small></span>
            <em>{{ itemStatusLabel(fence) }}</em>
          </button>
          <button
            class="ack-button"
            type="button"
            :aria-label="hasActiveAlert(fence) ? `确认 ${fence.name} 的本地演示告警` : `${fence.status === 'disarmed' ? '模拟布防' : '模拟撤防'} ${fence.name}`"
            @click="hasActiveAlert(fence) ? action('ack', { featureId: fence.id }) : action('set-fence', { featureId: fence.id, armed: fence.status === 'disarmed' })"
          >
            {{ hasActiveAlert(fence) ? '确认告警' : fence.status === 'disarmed' ? '模拟布防' : '模拟撤防' }}
          </button>
        </article>
      </div>
    </section>

    <section v-if="selected" class="security-preview">
      <div class="preview-surface" :class="selected.kind">
        <img v-if="selected.kind === 'camera'" class="selected-camera-glyph" :src="facilityIconDataUri('camera')" alt="摄像头" />
        <img v-else class="selected-fence-glyph" :src="facilityIconDataUri('fence')" alt="电子围栏" />
        <span>{{ selected.kind === 'camera' ? 'CAM' : 'FENCE' }}</span>
      </div>
      <div>
        <small>{{ selected.kind === 'camera' ? '本地演示点位 · 未接入实时视频' : `本地演示防区 · 防区范围 · ${selected.zone}` }}</small>
        <strong>{{ selected.name }}</strong>
        <p>{{ selected.note || selected.rule }}</p>
        <button v-if="hasActiveAlert(selected)" type="button" @click="action('ack', { featureId: selected.id })">确认本地告警</button>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.row-main.camera-row-main { grid-template-columns:36px minmax(0,1fr) auto; }
.camera-row-main img,.selected-camera-glyph,.fence-glyph,.selected-fence-glyph { width:36px; height:36px; object-fit:contain; }
.fence-glyph { opacity:.92; }
.disarmed .fence-glyph { opacity:.52; }
.alarm .fence-glyph { filter:saturate(1.35) brightness(1.08); }
.security-panel { position:absolute; top:100px; left:18px; width:400px; max-height:calc(100vh - 230px); padding:16px; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; color:var(--ops-text); border:1px solid var(--ops-line); border-radius:var(--ops-radius-md); background:var(--ops-surface); box-shadow:var(--ops-shadow); pointer-events:auto; }
.simulation-notice > .tabler-icon { color:var(--ops-warning); }
.simulation-copy { min-width:0; display:grid; gap:2px; }
.preview-surface > .tabler-icon,.selected-fence-glyph { width:30px; height:30px; }
.security-panel:focus-visible { outline:2px solid var(--ops-accent); outline-offset:2px; }
header { display:flex; align-items:end; justify-content:space-between; gap:12px; padding-bottom:12px; border-bottom:1px solid var(--ops-line-soft); } header span { color:var(--ops-accent); font:700 10px var(--ops-mono); letter-spacing:.14em; } h2 { margin:5px 0 0; font-size:20px; font-weight:650; } header em { padding:5px 9px; color:var(--ops-accent); border:1px solid var(--ops-line); border-radius:var(--ops-radius-sm); font-size:11px; font-style:normal; } header em.alert { color:var(--ops-danger); border-color:var(--ops-danger); background:oklch(32% .14 18/.2); }
.simulation-notice { display:grid; grid-template-columns:auto 1fr; align-items:center; gap:8px; margin:10px 0 0; padding:8px 9px; color:var(--ops-text-muted); border:1px solid oklch(80% .13 75/.32); border-radius:var(--ops-radius-sm); background:oklch(30% .06 75/.12); font-size:10px; line-height:1.4; }.simulation-notice strong { color:var(--ops-warning); font:700 9px var(--ops-mono); letter-spacing:.06em; white-space:nowrap; }
.security-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; margin:9px 0 11px; overflow:hidden; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:var(--ops-line-soft); }.security-stats article { padding:9px 6px; text-align:center; background:oklch(16% .025 225/.72); }.security-stats strong,.security-stats small { display:block; }.security-stats strong { font:700 19px var(--ops-mono); font-variant-numeric:tabular-nums; }.security-stats small { margin-top:4px; color:var(--ops-text-muted); font-size:10px; }
.security-tabs { display:grid; grid-template-columns:1fr 1fr; gap:3px; padding:3px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.6); }.security-tabs button,.section-actions button,.arm-actions button,.ack-button,.security-preview button { min-height:36px; color:var(--ops-text-muted); border:1px solid transparent; border-radius:var(--ops-radius-sm); background:transparent; cursor:pointer; transition:background var(--ops-ease),color var(--ops-ease),border-color var(--ops-ease); }.security-tabs button:hover,.section-actions button:hover,.arm-actions button:hover { color:var(--ops-text); background:var(--ops-surface-raised); }.security-tabs button.active { color:var(--ops-canvas); background:var(--ops-accent); font-weight:700; }
.security-section { margin-top:9px; }.section-actions { display:flex; align-items:center; justify-content:space-between; color:var(--ops-text-muted); font-size:11px; }.section-actions button { min-height:30px; padding:4px 8px; border-color:var(--ops-line-soft); }.arm-actions { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:7px; }.arm-actions button { padding:7px; border-color:var(--ops-line-soft); }.arm-actions button:first-child { color:var(--ops-canvas); background:var(--ops-accent); }.arm-actions .danger-secondary { color:var(--ops-danger); border-color:oklch(72% .19 18/.42); background:oklch(32% .14 18/.12); }
.disarm-confirm { grid-column:1/3; display:grid; grid-template-columns:1fr auto auto; align-items:center; gap:7px; padding:8px; border:1px solid oklch(72% .19 18/.42); border-radius:var(--ops-radius-sm); background:oklch(32% .14 18/.14); }.disarm-confirm span { color:var(--ops-text-soft); font-size:10px; line-height:1.35; }.disarm-confirm button { min-height:34px; padding:5px 8px; }.disarm-confirm button:first-of-type { color:var(--ops-text); background:var(--ops-danger); font-weight:700; }
.security-list { max-height:240px; margin-top:8px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--ops-line) transparent; }.security-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; margin-bottom:6px; border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.62); }.security-row:hover { background:var(--ops-surface-raised); }.security-row.selected { border-color:var(--ops-warning); background:oklch(30% .06 75/.1); }.security-row.alarm { border-color:oklch(72% .19 18/.48); background:oklch(32% .14 18/.1); }
.row-main { width:100%; min-width:0; min-height:44px; display:grid; grid-template-columns:36px minmax(0,1fr) auto; align-items:center; gap:9px; padding:9px 10px; color:inherit; text-align:left; border:0; background:transparent; cursor:pointer; }.security-row > .row-main:only-child { grid-column:1/-1; }.row-main span { min-width:0; }.row-main strong,.row-main small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.row-main strong { color:var(--ops-text); font-size:12px; font-weight:650; }.row-main small { margin-top:4px; color:var(--ops-text-muted); font-size:10px; }.row-main em { max-width:88px; color:var(--ops-success); font-size:10px; font-style:normal; line-height:1.3; text-align:right; }.offline .row-main em { color:var(--ops-text-muted); }.maintenance .row-main em { color:var(--ops-warning); }.alarm .row-main em { color:var(--ops-danger); }
.ack-button { position:static; align-self:center; min-height:32px; margin-right:7px; padding:3px 7px; color:var(--ops-danger); border-color:oklch(72% .19 18/.38); font-size:10px; white-space:nowrap; }
.security-preview { display:grid; grid-template-columns:94px 1fr; gap:11px; margin-top:10px; padding-top:10px; border-top:1px solid var(--ops-line-soft); }.preview-surface { position:relative; min-height:76px; overflow:hidden; display:grid; place-items:center; color:var(--ops-accent); border:1px solid var(--ops-line-soft); border-radius:var(--ops-radius-sm); background:oklch(16% .025 225/.72); font:700 12px var(--ops-mono); }.preview-surface::after { content:"NO SIGNAL"; position:absolute; left:6px; bottom:5px; color:var(--ops-text-muted); font:7px var(--ops-mono); letter-spacing:.08em; }.security-preview > div:last-child { min-width:0; }.security-preview small,.security-preview strong { display:block; }.security-preview small { color:var(--ops-warning); font-size:10px; }.security-preview strong { margin-top:5px; font-size:13px; font-weight:650; }.security-preview p { margin:5px 0; color:var(--ops-text-muted); font-size:11px; line-height:1.4; }.security-preview button { min-height:32px; padding:4px 8px; color:var(--ops-danger); border-color:oklch(72% .19 18/.4); font-size:10px; }
@media (max-width:600px) { .security-panel { top:auto; bottom:126px; left:10px; right:10px; width:auto; height:32vh; max-height:32vh; padding:12px; overflow-y:auto; border-radius:8px; }.security-panel::before { content:""; display:block; width:36px; height:3px; margin:-5px auto 7px; border-radius:3px; background:var(--ops-line); } header { padding-bottom:8px; } h2 { font-size:17px; }.simulation-notice { grid-template-columns:1fr; gap:3px; }.security-stats { margin:8px 0; }.security-section { margin-top:7px; }.security-list { max-height:none; }.security-preview { display:none; }.security-tabs button,.arm-actions button,.section-actions button { min-height:44px; }.ack-button { min-width:64px; min-height:40px; } }
</style>
