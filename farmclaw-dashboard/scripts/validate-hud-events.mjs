import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/components/FarmclawHud.vue', import.meta.url), 'utf8')

for (const implementation of [
  'const eventsCollapsed = ref(false)',
  "['event-panel', 'hud-panel', { collapsed: eventsCollapsed }]",
  'v-if="!eventsCollapsed"',
  'function toggleEvents()',
  ':aria-expanded="(!eventsCollapsed).toString()"',
  ':aria-label="eventsCollapsed ? \'展开系统事件\' : \'收起系统事件\'"',
  'event-panel.collapsed'
]) {
  assert.equal(source.includes(implementation), true, `缺少系统事件收起实现：${implementation}`)
}

console.log('HUD event stream validation passed: collapsible state, accessible toggle, and compact panel styling verified')
