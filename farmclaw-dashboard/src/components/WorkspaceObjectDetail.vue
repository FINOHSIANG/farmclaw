<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import TablerIcon from './TablerIcon.vue'
import { workspaceObjectImage } from '../utils/workspaceModel.js'
const props = defineProps({ object: { type: Object, required: true }, items: { type: Array, default: () => [] }, history: { type: Array, default: () => [] } })
const emit = defineEmits(['close', 'locate', 'open-item', 'acknowledge'])
const section = ref('overview')
const content = ref(null)
const heading = ref(null)
const confirmAck = ref(false)
const related = computed(() => props.items.filter(item => item.objectKey === props.object.key))
watch(() => props.object.key, async () => {
  section.value = 'overview'
  confirmAck.value = false
  await nextTick()
  heading.value?.focus({ preventScroll: true })
}, { immediate: true })
watch([() => props.object.content, content], ([node, container]) => {
  if (!container) return
  container.replaceChildren(...(node ? [node] : []))
}, { flush: 'post' })
onBeforeUnmount(() => content.value?.replaceChildren())
</script>

<template>
  <aside class="workspace-object-detail" role="tabpanel" aria-label="对象详情">
    <div class="object-backline"><button type="button" @click="emit('close')"><TablerIcon name="arrow-left" :size="17" />返回专题</button><button type="button" title="关闭对象详情" aria-label="关闭对象详情" @click="emit('close')"><TablerIcon name="x" :size="18" /></button></div>
    <header class="object-heading"><img :src="workspaceObjectImage(object)" :alt="object.type" /><div><small>{{ object.type }}</small><h2 ref="heading" tabindex="-1">{{ object.name }}</h2></div></header>
    <div class="object-meta"><span>{{ object.id }}</span><em :class="object.tone">{{ object.status }}</em></div>
    <p class="object-source">{{ object.sourceLabel }}</p>
    <div class="object-actions"><button type="button" :disabled="!object.coordinates" @click="emit('locate', object)"><TablerIcon name="map-pin" :size="16" />{{ object.coordinates ? '定位对象' : '未绑定位置' }}</button><button v-if="object.canAcknowledge" type="button" @click="confirmAck = !confirmAck">确认演示告警</button></div>
    <div v-if="confirmAck && object.canAcknowledge" class="object-ack-confirm"><p>仅确认本页面演示告警，不改变现场设备状态。</p><button type="button" @click="emit('acknowledge', object); confirmAck = false">确认本地记录</button><button type="button" @click="confirmAck = false">取消</button></div>
    <div class="object-tabs" role="group" aria-label="对象详情分区"><button type="button" :aria-pressed="section === 'overview'" @click="section = 'overview'">概况</button><button type="button" :aria-pressed="section === 'related'" @click="section = 'related'">关联事项 {{ related.length }}</button><button type="button" :aria-pressed="section === 'history'" @click="section = 'history'">会话记录</button></div>
    <section v-show="section === 'overview'" class="object-overview">
      <div ref="content" class="object-content"></div>
      <dl v-if="!object.content" class="object-facts"><div v-for="[label, value] in object.facts" :key="label"><dt>{{ label }}</dt><dd>{{ value }}</dd></div></dl>
      <p v-if="object.note" class="object-note">{{ object.note }}</p>
    </section>
    <section v-if="section === 'related'" class="object-related"><article v-for="item in related" :key="item.key"><strong>{{ item.title }}</strong><p>{{ item.detail }}</p><button v-if="item.action === 'approval'" type="button" @click="emit('open-item', item)">前往审批<TablerIcon name="chevron-right" :size="15" /></button><small v-else>{{ item.status }} · {{ item.source }}</small></article><p v-if="!related.length" class="workspace-empty">暂无关联事项，未关联的业务档案不会自动推断。</p></section>
    <section v-if="section === 'history'" class="object-history"><p class="object-note">仅记录本次页面会话，尚未接入历史档案。</p><article v-for="entry in history" :key="entry.id"><time>{{ new Date(entry.at).toLocaleTimeString('zh-CN', { hour12: false }) }}</time><p>{{ entry.text }}</p></article><p v-if="!history.length" class="workspace-empty">本次会话暂无记录</p></section>
  </aside>
</template>
