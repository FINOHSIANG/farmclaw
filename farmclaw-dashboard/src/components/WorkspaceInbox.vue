<script setup>
import { computed, ref } from 'vue'
import TablerIcon from './TablerIcon.vue'
const props = defineProps({ items: { type: Array, default: () => [] } })
const emit = defineEmits(['close', 'open'])
const filter = ref('all')
const filters = [['all', '全部'], ['risk', '生产'], ['security', '安防'], ['equipment', '设备'], ['approval', '审批']]
const filtered = computed(() => props.items.filter(item => filter.value === 'all' || item.category === filter.value))
</script>

<template>
  <aside class="event-panel hud-panel workspace-inbox" aria-label="待办中心">
    <div class="panel-heading"><div><span>人工复核与审批</span><strong>待办中心 <small>{{ items.length }}</small></strong></div><button class="event-toggle" type="button" aria-label="关闭待办中心" title="关闭待办中心" @click="emit('close')"><TablerIcon name="x" :size="18" /></button></div>
    <div class="inbox-filters" role="group" aria-label="待办类型"><button v-for="[id, label] in filters" :key="id" type="button" :aria-pressed="filter === id" @click="filter = id">{{ label }}<small>{{ id === 'all' ? items.length : items.filter(item => item.category === id).length }}</small></button></div>
    <div class="inbox-list" aria-live="polite"><article v-for="item in filtered" :key="item.key" :data-inbox-key="item.key"><div class="inbox-item-heading"><span :class="item.tone">{{ item.status }}</span><small>{{ item.scope }}</small></div><h3>{{ item.title }}</h3><p>{{ item.detail }}</p><footer><small>{{ item.source }}</small><button type="button" @click="emit('open', item)">{{ item.action === 'approval' ? '前往审批' : '查看对象' }}<TablerIcon name="chevron-right" :size="15" /></button></footer></article><p v-if="!filtered.length" class="workspace-empty">当前分类没有待办事项</p></div>
  </aside>
</template>
