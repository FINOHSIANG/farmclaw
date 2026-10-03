import assert from 'node:assert/strict'
import { FARM_ASSET_GLYPHS } from '../src/utils/farmAssetGlyphs.js'
import {
  TABLER_ICON_COMMIT,
  TABLER_ICON_NAMES,
  TABLER_ICON_REPOSITORY,
  TABLER_ICON_SOURCES,
  tablerIconDataUri,
  tablerIconMarkup,
  tablerIconSvg
} from '../src/utils/tablerIcons.js'
import {
  FACILITY_ICON_IDS,
  FACILITY_TABLER_ICON_NAMES,
  facilityIconSvg,
  facilityTablerIconName
} from '../src/utils/facilityIcons.js'

assert.match(TABLER_ICON_REPOSITORY, /^https:\/\/github\.com\/tabler\/tabler-icons$/)
assert.match(TABLER_ICON_COMMIT, /^[0-9a-f]{40}$/)
assert.ok(TABLER_ICON_NAMES.length >= 35, '本地图标注册表应覆盖地图、设施、农机和指令栏')

for (const name of TABLER_ICON_NAMES) {
  assert.equal(typeof tablerIconMarkup(name), 'string')
  assert.ok(tablerIconMarkup(name).length > 0)
  assert.equal(TABLER_ICON_SOURCES[name].startsWith(`${TABLER_ICON_REPOSITORY}/blob/${TABLER_ICON_COMMIT}/icons/outline/`), true)
  const svg = tablerIconSvg(name)
  assert.match(svg, /^<svg /)
  assert.match(svg, /viewBox="0 0 24 24"/)
  assert.doesNotMatch(svg, /<(?:script|iframe)|\son\w+\s*=|(?:href|src)\s*=/i)
  assert.equal(decodeURIComponent(tablerIconDataUri(name).split(',')[1]), svg)
}

for (const [facility, iconName] of Object.entries(FACILITY_TABLER_ICON_NAMES)) {
  assert.equal(facilityTablerIconName(facility), iconName)
  assert.equal(FACILITY_ICON_IDS[facility], `farmclaw-facility-${facility}`)
  const svg = facilityIconSvg(facility)
  assert.match(svg, /viewBox="0 0 48 48"/)
  assert.ok(svg.includes(FARM_ASSET_GLYPHS[facility] || tablerIconMarkup(iconName)))
}

assert.equal(facilityTablerIconName('unknown'), 'box')
console.log(`Tabler icon validation passed: ${TABLER_ICON_NAMES.length} local icons, ${Object.keys(FACILITY_TABLER_ICON_NAMES).length} facility mappings, pinned commit ${TABLER_ICON_COMMIT.slice(0, 7)}`)
