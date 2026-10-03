<script setup>
import { computed } from 'vue'
import { tablerIconMarkup } from '@/utils/tablerIcons.js'

const props = defineProps({
  name: { type: String, default: 'box' },
  size: { type: [Number, String], default: 20 },
  strokeWidth: { type: [Number, String], default: 1.8 },
  title: { type: String, default: '' }
})

const markup = computed(() => tablerIconMarkup(props.name))
</script>

<template>
  <svg
    :class="['tabler-icon', `tabler-icon-${name}`]"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    focusable="false"
    :role="title ? 'img' : undefined"
    :aria-label="title || undefined"
    :aria-hidden="title ? undefined : 'true'"
  >
    <title v-if="title">{{ title }}</title>
    <g v-html="markup"></g>
  </svg>
</template>

<style scoped>
.tabler-icon { display: inline-block; flex: 0 0 auto; vertical-align: middle; }
</style>
