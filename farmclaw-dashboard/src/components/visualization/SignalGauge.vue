<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: null },
  unit: { type: String, default: '' },
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  safeMin: { type: Number, required: true },
  safeMax: { type: Number, required: true }
})

const numericValue = computed(() => {
  const value = Number(props.value)
  return Number.isFinite(value) ? value : null
})
const known = computed(() => numericValue.value !== null)
const status = computed(() => {
  if (!known.value) return 'unknown'
  return numericValue.value >= props.safeMin && numericValue.value <= props.safeMax ? 'normal' : 'attention'
})
const clamp = (value) => Math.max(0, Math.min(100, value))
const ratio = (value) => clamp(((value - props.min) / Math.max(props.max - props.min, 1)) * 100)
const markerPosition = computed(() => ratio(numericValue.value ?? props.min))
const safeStart = computed(() => ratio(props.safeMin))
const safeWidth = computed(() => ratio(props.safeMax) - safeStart.value)
const ariaLabel = computed(() => known.value
  ? `${props.label} ${numericValue.value}${props.unit}，${status.value === 'normal' ? '位于适宜范围' : '超出适宜范围'}`
  : `${props.label}尚未采集`)
</script>

<template>
  <article :class="['signal-gauge', status]">
    <div class="signal-heading">
      <span><i aria-hidden="true"></i>{{ label }}</span>
      <strong v-if="known">{{ numericValue }}<em>{{ unit }}</em></strong>
      <strong v-else class="pending-value">未采集</strong>
    </div>
    <div class="signal-scale" role="img" :aria-label="ariaLabel">
      <span class="safe-band" :style="{ left: `${safeStart}%`, width: `${safeWidth}%` }"></span>
      <i v-if="known" class="signal-marker" :style="{ left: `${markerPosition}%` }"></i>
    </div>
    <div class="signal-caption">
      <span>{{ min }}{{ unit }}</span>
      <span>适宜 {{ safeMin }}–{{ safeMax }}{{ unit }}</span>
      <span>{{ max }}{{ unit }}</span>
    </div>
  </article>
</template>

<style scoped>
.signal-gauge { min-width:0; padding:10px 9px 9px; background:var(--ops-surface-inset); }
.signal-heading { min-height:30px; display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
.signal-heading > span { display:flex; align-items:center; gap:6px; color:var(--ops-text-soft); font-size:11px; line-height:1.3; }
.signal-heading > span i { width:7px; height:7px; flex:0 0 7px; border:1.5px solid var(--ops-neutral); transform:rotate(45deg); }
.signal-heading strong { color:var(--ops-text); font:700 16px/1 var(--ops-mono); font-variant-numeric:tabular-nums; }
.signal-heading em { margin-left:3px; color:var(--ops-text-muted); font:9px var(--ops-mono); font-style:normal; }
.signal-heading .pending-value { color:var(--ops-text-muted); font:600 10px/1.2 var(--ops-font); }
.signal-scale { position:relative; height:5px; margin-top:5px; border-radius:1px; background:var(--ops-chart-grid); }
.safe-band { position:absolute; inset-block:0; border-radius:1px; background:oklch(80% .13 150/.3); }
.signal-marker { position:absolute; top:-3px; width:2px; height:11px; margin-left:-1px; border-radius:1px; background:var(--ops-success); box-shadow:0 0 0 2px var(--ops-surface-inset); }
.attention .signal-marker { background:var(--ops-warning); }
.normal .signal-heading > span i { border-color:var(--ops-success); background:var(--ops-success); transform:none; border-radius:50%; }
.attention .signal-heading > span i { border:0; background:var(--ops-warning); clip-path:polygon(50% 0,100% 100%,0 100%); transform:none; }
.signal-caption { display:flex; align-items:center; justify-content:space-between; gap:5px; margin-top:5px; color:var(--ops-text-muted); font:10px/1.2 var(--ops-mono); }
.signal-caption span:nth-child(2) { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
@media (max-width:600px) {
  .signal-gauge { min-width:128px; padding:9px 8px; }
  .signal-heading { min-height:28px; }
  .signal-heading > span { font-size:10px; }
  .signal-caption { font-size:9px; }
}
</style>
