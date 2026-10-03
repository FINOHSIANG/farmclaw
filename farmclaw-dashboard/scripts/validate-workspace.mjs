import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getViewportPadding } from '../src/utils/mapViewport.js'

const read = (file) => readFile(new URL(file, import.meta.url), 'utf8')
const [hud, view, map, css] = await Promise.all([
  read('../src/components/FarmclawHud.vue'),
  read('../src/views/index.vue'),
  read('../src/utils/freeMap.js'),
  read('../src/style/workspace.css')
])

const desktop = { width: 1440, height: 1000 }
assert.equal(getViewportPadding(desktop).left, 400)
assert.equal(getViewportPadding({ ...desktop, panelVisible: false }).left, 24)
assert.equal(getViewportPadding({ ...desktop, eventsOpen: true }).right, 336)
assert.equal(getViewportPadding({ ...desktop, hasAttachments: true }).bottom, 164)
assert.equal(getViewportPadding({ width: 390, height: 844, panelVisible: false }).bottom, 90)
assert.ok(getViewportPadding({ width: 390, height: 844, mobileExpanded: true }).bottom > getViewportPadding({ width: 390, height: 844 }).bottom)

for (const [width, height] of [[1440, 1000], [1366, 768], [1024, 768], [768, 1024], [601, 540], [600, 768], [390, 844], [320, 568], [844, 390]]) {
  for (const panelVisible of [true, false]) {
    for (const mobileExpanded of [true, false]) {
      for (const eventsOpen of [true, false]) {
        for (const hasAttachments of [true, false]) {
          const options = { width, height, panelVisible, mobileExpanded, eventsOpen, hasAttachments }
          const padding = getViewportPadding(options)
          assert.ok(Object.values(padding).every((n) => Number.isFinite(n) && n >= 0))
          assert.ok(width - padding.left - padding.right >= 160, JSON.stringify(options))
          assert.ok(height - padding.top - padding.bottom >= Math.min(140, height * 0.25), JSON.stringify(options))
          assert.deepEqual(
            getViewportPadding({ ...options, presentation: true }),
            getViewportPadding({ width, height, presentation: true }),
            'Presentation framing must not depend on workspace state'
          )
        }
      }
    }
  }
}

assert.ok(hud.includes('v-for="item in workspaceTopics"'))
assert.ok(hud.includes('inspectorVisible = !inspectorVisible'))
assert.ok(hud.includes("'workspace-layout'"))
assert.ok(hud.includes('hasAttachments: attachments.value.length > 0 || Boolean(fileError.value)'))
assert.ok(view.includes('@workspace-layout="handleWorkspaceLayout"'))
assert.ok(view.includes(':map-view="mapView"'))
assert.ok(view.includes('freeMapAdapter.resizeFreeMap(workspaceLayout)'))
assert.ok(map.includes("map.on('pitchend'"))
assert.ok(map.includes("map.easeTo({ pitch: view === '2d' ? 0 : DEFAULT_CAMERA.pitch"))
assert.equal((map.match(/pitch: 52/g) || []).length, 1, 'Only the default camera may force 3D; object focus preserves user pitch')
assert.ok(css.includes('--inspector-width: 376px'))
assert.ok(css.includes('height:calc(100dvh - 250px)'))
assert.ok(css.includes('.mobile-panel-expanded .map-context :is(.map-context-controls'))
assert.ok(css.includes('.legend-open .map-tools { visibility:hidden; }'))
assert.ok(css.includes('.pane-hidden [role="tabpanel"] { display:none; }'))
assert.ok(css.includes('.maplibregl-ctrl-attrib-inner'))
assert.ok(css.includes('letter-spacing: 0'))
console.log('Workspace PASS: 144 layout combinations, panel state, presentation isolation and camera view contracts')
