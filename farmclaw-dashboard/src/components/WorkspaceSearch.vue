<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TablerIcon from './TablerIcon.vue'
import { searchWorkspaceObjects, workspaceObjectImage } from '../utils/workspaceModel.js'

const props = defineProps({ objects: { type: Array, default: () => [] }, ready: Boolean })
const emit = defineEmits(['select'])
const open = ref(false)
const query = ref('')
const category = ref('all')
const activeIndex = ref(0)
const root = ref(null)
const input = ref(null)
const trigger = ref(null)
const categories = [['all', '全部'], ['field', '地块'], ['machinery', '农机'], ['security', '安防'], ['facility', '设施']]
const matches = computed(() => searchWorkspaceObjects(props.objects, query.value, category.value))
const results = computed(() => matches.value.slice(0, 30))
watch([query, category], () => { activeIndex.value = 0 })

async function toggle() {
  open.value = !open.value
  if (open.value) { await nextTick(); input.value?.focus() }
}
function close(restoreFocus = false) {
  open.value = false
  if (restoreFocus) trigger.value?.focus()
}
function select(item) { emit('select', item); close() }
async function navigate(event) {
  if (event.key === 'Escape') { event.preventDefault(); close(true); return }
  if (event.key === 'Enter') { event.preventDefault(); if (results.value[activeIndex.value]) select(results.value[activeIndex.value]); return }
  if (!['ArrowDown', 'ArrowUp'].includes(event.key) || !results.value.length) return
  event.preventDefault()
  activeIndex.value = (activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + results.value.length) % results.value.length
  await nextTick()
  document.getElementById(`workspace-result-${activeIndex.value}`)?.scrollIntoView({ block: 'nearest' })
}
function outside(event) { if (!root.value?.contains(event.target)) close() }
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <div ref="root" class="workspace-search" @keydown.esc.stop="close(true)">
    <button ref="trigger" class="workspace-search-trigger" type="button" aria-label="搜索地块与设备" title="搜索地块与设备" :aria-expanded="open" aria-controls="workspace-search-panel" @click="toggle"><TablerIcon name="search" :size="18" /><span>搜索地块、农机、设备</span></button>
    <section v-if="open" id="workspace-search-panel" class="workspace-search-panel" aria-label="对象搜索">
      <div class="workspace-search-input"><TablerIcon name="search" :size="18" /><input ref="input" v-model="query" role="combobox" aria-label="名称或编号" aria-autocomplete="list" aria-expanded="true" aria-controls="workspace-search-results" :aria-activedescendant="results.length ? `workspace-result-${activeIndex}` : undefined" placeholder="输入名称、编号或区域" @keydown="navigate" /><button type="button" aria-label="关闭搜索" @click="close(true)"><TablerIcon name="x" :size="18" /></button></div>
      <div class="workspace-search-categories" role="group" aria-label="对象类型"><button v-for="[id, label] in categories" :key="id" type="button" :aria-pressed="category === id" @click="category = id">{{ label }}</button></div>
      <p class="workspace-search-count" aria-live="polite">{{ ready ? `${matches.length} 个匹配对象${matches.length > 30 ? ' · 显示前 30 项' : ''}` : '正在加载地图对象，已显示本地设备档案' }}</p>
      <div id="workspace-search-results" role="listbox" aria-label="匹配对象" class="workspace-search-results">
        <button v-for="(item, index) in results" :id="`workspace-result-${index}`" :key="item.key" role="option" type="button" :aria-selected="index === activeIndex" :data-object-key="item.key" @pointerenter="activeIndex = index" @click="select(item)"><img :src="workspaceObjectImage(item)" alt="" /><span><strong>{{ item.name }}</strong><small>{{ item.id }} · {{ item.type }}</small></span><em>{{ item.coordinates ? item.status : '未绑定位置' }}</em></button>
      </div>
      <p v-if="!results.length" class="workspace-empty">没有匹配对象</p>
    </section>
  </div>
</template>
