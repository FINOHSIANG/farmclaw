/**
 * 四时使用的 Tabler Icons 轮廓图标注册表。
 *
 * 图标路径数据取自 Tabler Icons 官方仓库固定提交，运行时不依赖 CDN，
 * 既可以渲染为 Vue 内联 SVG，也可以包装成 MapLibre 可加载的 data URI。
 * 来源与许可信息见 docs/THIRD_PARTY_NOTICES.md。
 */

export const TABLER_ICON_REPOSITORY = 'https://github.com/tabler/tabler-icons'
export const TABLER_ICON_COMMIT = '5a0fe38e97784d94279ce4eb1bf85f9a91bf027e'

const TABLER_ICON_SOURCE_ROOT = `${TABLER_ICON_REPOSITORY}/blob/${TABLER_ICON_COMMIT}/icons/outline`

export const TABLER_ICON_SOURCES = Object.freeze({
  search: `${TABLER_ICON_SOURCE_ROOT}/search.svg`,
  camera: `${TABLER_ICON_SOURCE_ROOT}/camera.svg`,
  'building-warehouse': `${TABLER_ICON_SOURCE_ROOT}/building-warehouse.svg`,
  'building-community': `${TABLER_ICON_SOURCE_ROOT}/building-community.svg`,
  building: `${TABLER_ICON_SOURCE_ROOT}/building.svg`,
  flask: `${TABLER_ICON_SOURCE_ROOT}/flask.svg`,
  box: `${TABLER_ICON_SOURCE_ROOT}/box.svg`,
  droplet: `${TABLER_ICON_SOURCE_ROOT}/droplet.svg`,
  wind: `${TABLER_ICON_SOURCE_ROOT}/wind.svg`,
  'test-pipe': `${TABLER_ICON_SOURCE_ROOT}/test-pipe.svg`,
  fish: `${TABLER_ICON_SOURCE_ROOT}/fish.svg`,
  antenna: `${TABLER_ICON_SOURCE_ROOT}/antenna.svg`,
  tractor: `${TABLER_ICON_SOURCE_ROOT}/tractor.svg`,
  forklift: `${TABLER_ICON_SOURCE_ROOT}/forklift.svg`,
  spray: `${TABLER_ICON_SOURCE_ROOT}/spray.svg`,
  seedling: `${TABLER_ICON_SOURCE_ROOT}/seedling.svg`,
  car: `${TABLER_ICON_SOURCE_ROOT}/car.svg`,
  'lawn-mower': `${TABLER_ICON_SOURCE_ROOT}/lawn-mower.svg`,
  truck: `${TABLER_ICON_SOURCE_ROOT}/truck.svg`,
  map: `${TABLER_ICON_SOURCE_ROOT}/map.svg`,
  'map-pin': `${TABLER_ICON_SOURCE_ROOT}/map-pin.svg`,
  'focus-2': `${TABLER_ICON_SOURCE_ROOT}/focus-2.svg`,
  satellite: `${TABLER_ICON_SOURCE_ROOT}/satellite.svg`,
  drone: `${TABLER_ICON_SOURCE_ROOT}/drone.svg`,
  maximize: `${TABLER_ICON_SOURCE_ROOT}/maximize.svg`,
  x: `${TABLER_ICON_SOURCE_ROOT}/x.svg`,
  'chevron-up': `${TABLER_ICON_SOURCE_ROOT}/chevron-up.svg`,
  'chevron-down': `${TABLER_ICON_SOURCE_ROOT}/chevron-down.svg`,
  'chevron-right': `${TABLER_ICON_SOURCE_ROOT}/chevron-right.svg`,
  'list-details': `${TABLER_ICON_SOURCE_ROOT}/list-details.svg`,
  'arrow-left': `${TABLER_ICON_SOURCE_ROOT}/arrow-left.svg`,
  'alert-triangle': `${TABLER_ICON_SOURCE_ROOT}/alert-triangle.svg`,
  'alert-circle': `${TABLER_ICON_SOURCE_ROOT}/alert-circle.svg`,
  paperclip: `${TABLER_ICON_SOURCE_ROOT}/paperclip.svg`,
  file: `${TABLER_ICON_SOURCE_ROOT}/file.svg`,
  send: `${TABLER_ICON_SOURCE_ROOT}/send.svg`,
  settings: `${TABLER_ICON_SOURCE_ROOT}/settings.svg`,
  'circle-check': `${TABLER_ICON_SOURCE_ROOT}/circle-check.svg`,
  'shield-check': `${TABLER_ICON_SOURCE_ROOT}/shield-check.svg`,
  plus: `${TABLER_ICON_SOURCE_ROOT}/plus.svg`,
  minus: `${TABLER_ICON_SOURCE_ROOT}/minus.svg`,
  temperature: `${TABLER_ICON_SOURCE_ROOT}/temperature.svg`,
  droplets: `${TABLER_ICON_SOURCE_ROOT}/droplets.svg`,
  battery: `${TABLER_ICON_SOURCE_ROOT}/battery.svg`,
  bolt: `${TABLER_ICON_SOURCE_ROOT}/bolt.svg`,
  activity: `${TABLER_ICON_SOURCE_ROOT}/activity.svg`,
  clock: `${TABLER_ICON_SOURCE_ROOT}/clock.svg`
})

const ICON_MARKUP = Object.freeze({
  search: '<path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M21 21l-6 -6"/>',
  camera: '<path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>',
  'building-warehouse': '<path d="M3 21v-13l9 -4l9 4v13"/><path d="M13 13h4v8h-10v-6h6"/><path d="M13 21v-9a1 1 0 0 0 -1 -1h-2a1 1 0 0 0 -1 1v3"/>',
  'building-community': '<path d="M8 9l5 5v7h-5v-4m0 4h-5v-7l5 -5m1 1v-6a1 1 0 0 1 1 -1h10a1 1 0 0 1 1 1v17h-8"/><path d="M13 7l0 .01"/><path d="M17 7l0 .01"/><path d="M17 11l0 .01"/><path d="M17 15l0 .01"/>',
  building: '<path d="M3 21l18 0"/><path d="M9 8l1 0"/><path d="M9 12l1 0"/><path d="M9 16l1 0"/><path d="M14 8l1 0"/><path d="M14 12l1 0"/><path d="M14 16l1 0"/><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16"/>',
  flask: '<path d="M9 3l6 0"/><path d="M10 9l4 0"/><path d="M10 3v6l-4 11a.7 .7 0 0 0 .5 1h11a.7 .7 0 0 0 .5 -1l-4 -11v-6"/>',
  box: '<path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5"/><path d="M12 12l8 -4.5"/><path d="M12 12l0 9"/><path d="M12 12l-8 -4.5"/>',
  droplet: '<path d="M7.502 19.423c2.602 2.105 6.395 2.105 8.996 0c2.602 -2.105 3.262 -5.708 1.566 -8.546l-4.89 -7.26c-.42 -.625 -1.287 -.803 -1.936 -.397a1.376 1.376 0 0 0 -.41 .397l-4.893 7.26c-1.695 2.838 -1.035 6.441 1.567 8.546"/>',
  wind: '<path d="M5 8h8.5a2.5 2.5 0 1 0 -2.34 -3.24"/><path d="M3 12h15.5a2.5 2.5 0 1 1 -2.34 3.24"/><path d="M4 16h5.5a2.5 2.5 0 1 1 -2.34 3.24"/>',
  'test-pipe': '<path d="M20 8.04l-12.122 12.124a2.857 2.857 0 1 1 -4.041 -4.04l12.122 -12.124"/><path d="M7 13h8"/><path d="M19 15l1.5 1.6a2 2 0 1 1 -3 0l1.5 -1.6"/><path d="M15 3l6 6"/>',
  fish: '<path d="M16.69 7.44a6.973 6.973 0 0 0 -1.69 4.56c0 1.747 .64 3.345 1.699 4.571"/><path d="M2 9.504c7.715 8.647 14.75 10.265 20 2.498c-5.25 -7.761 -12.285 -6.142 -20 2.504"/><path d="M18 11v.01"/><path d="M11.5 10.5c-.667 1 -.667 2 0 3"/>',
  antenna: '<path d="M20 4v8"/><path d="M16 4.5v7"/><path d="M12 5v16"/><path d="M8 5.5v5"/><path d="M4 6v4"/><path d="M20 8h-16"/>',
  tractor: '<path d="M3 15a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M7 15l0 .01"/><path d="M17 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M10.5 17l6.5 0"/><path d="M20 15.2v-4.2a1 1 0 0 0 -1 -1h-6l-2 -5h-6v6.5"/><path d="M18 5h-1a1 1 0 0 0 -1 1v4"/>',
  forklift: '<path d="M3 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M12 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M7 17l5 0"/><path d="M3 17v-6h13v6"/><path d="M5 11v-4h4"/><path d="M9 11v-6h4l3 6"/><path d="M22 15h-3v-10"/><path d="M16 13l3 0"/>',
  spray: '<path d="M4 12a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2l0 -7"/><path d="M6 10v-4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v4"/><path d="M15 7h.01"/><path d="M18 9h.01"/><path d="M18 5h.01"/><path d="M21 3h.01"/><path d="M21 7h.01"/><path d="M21 11h.01"/><path d="M10 7h1"/>',
  seedling: '<path d="M12 10a6 6 0 0 0 -6 -6h-3v2a6 6 0 0 0 6 6h3"/><path d="M12 14a6 6 0 0 1 6 -6h3v1a6 6 0 0 1 -6 6h-3"/><path d="M12 20l0 -10"/>',
  car: '<path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5"/>',
  'lawn-mower': '<path d="M6 11h5.38a1 1 0 0 1 .9 .55l.72 1.45h5a1 1 0 0 1 1 1v2"/><path d="M3 4h1.13a1 1 0 0 1 1 .86l1.59 11.14"/><path d="M17 18h-8"/><path d="M9 18a2 2 0 1 1 -4 0a2 2 0 0 1 4 0"/><path d="M21 18a2 2 0 1 1 -4 0a2 2 0 0 1 4 0"/>',
  truck: '<path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5"/>',
  map: '<path d="M3 6l6 -3l6 3l6 -3v15l-6 3l-6 -3l-6 3v-15"/><path d="M9 3v15"/><path d="M15 6v15"/>',
  'map-pin': '<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0"/>',
  'focus-2': '<path d="M12 4v-1"/><path d="M12 21v-1"/><path d="M4 12h-1"/><path d="M21 12h-1"/><path d="M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0 -8"/>',
  satellite: '<path d="M3.707 6.293l2.586 -2.586a1 1 0 0 1 1.414 0l5.586 5.586a1 1 0 0 1 0 1.414l-2.586 2.586a1 1 0 0 1 -1.414 0l-5.586 -5.586a1 1 0 0 1 0 -1.414"/><path d="M6 10l-3 3l3 3l3 -3"/><path d="M10 6l3 -3l3 3l-3 3"/><path d="M12 12l1.5 1.5"/><path d="M14.5 17a2.5 2.5 0 0 0 2.5 -2.5"/><path d="M15 21a6 6 0 0 0 6 -6"/>',
  drone: '<path d="M10 10h4v4h-4l0 -4"/><path d="M10 10l-3.5 -3.5"/><path d="M9.96 6a3.5 3.5 0 1 0 -3.96 3.96"/><path d="M14 10l3.5 -3.5"/><path d="M18 9.96a3.5 3.5 0 1 0 -3.96 -3.96"/><path d="M14 14l3.5 3.5"/><path d="M14.04 18a3.5 3.5 0 1 0 3.96 -3.96"/><path d="M10 14l-3.5 3.5"/><path d="M6 14.04a3.5 3.5 0 1 0 3.96 3.96"/>',
  maximize: '<path d="M4 8v-2a2 2 0 0 1 2 -2h2"/><path d="M4 16v2a2 2 0 0 0 2 2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M16 20h2a2 2 0 0 0 2 -2v-2"/>',
  x: '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
  'chevron-up': '<path d="M6 15l6 -6l6 6"/>',
  'chevron-down': '<path d="M6 9l6 6l6 -6"/>',
  'chevron-right': '<path d="M9 6l6 6l-6 6"/>',
  'list-details': '<path d="M13 5h8"/><path d="M13 9h5"/><path d="M13 15h8"/><path d="M13 19h5"/><path d="M3 5a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/><path d="M3 15a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/>',
  'arrow-left': '<path d="M5 12l14 0"/><path d="M5 12l6 6"/><path d="M5 12l6 -6"/>',
  'alert-triangle': '<path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0"/><path d="M12 16h.01"/>',
  'alert-circle': '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  paperclip: '<path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 1 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2"/>',
  send: '<path d="M10 14l11 -11"/><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5"/>',
  settings: '<path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>',
  'circle-check': '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M9 12l2 2l4 -4"/>',
  'shield-check': '<path d="M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06"/><path d="M15 19l2 2l4 -4"/>',
  plus: '<path d="M12 5l0 14"/><path d="M5 12l14 0"/>',
  minus: '<path d="M5 12l14 0"/>',
  temperature: '<path d="M10 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 0 0 -4 0v8.5"/><path d="M10 9l4 0"/>',
  droplets: '<path d="M4.072 20.3a2.999 2.999 0 0 0 3.856 0a3.002 3.002 0 0 0 .67 -3.798l-2.095 -3.227a.6 .6 0 0 0 -1.005 0l-2.098 3.227a3.003 3.003 0 0 0 .671 3.798"/><path d="M16.072 20.3a2.999 2.999 0 0 0 3.856 0a3.002 3.002 0 0 0 .67 -3.798l-2.095 -3.227a.6 .6 0 0 0 -1.005 0l-2.098 3.227a3.003 3.003 0 0 0 .671 3.798"/><path d="M10.072 10.3a2.999 2.999 0 0 0 3.856 0a3.002 3.002 0 0 0 .67 -3.798l-2.095 -3.227a.6 .6 0 0 0 -1.005 0l-2.098 3.227a3.003 3.003 0 0 0 .671 3.798l.001 0"/>',
  battery: '<path d="M6 7h11a2 2 0 0 1 2 2v.5a.5 .5 0 0 0 .5 .5a.5 .5 0 0 1 .5 .5v3a.5 .5 0 0 1 -.5 .5a.5 .5 0 0 0 -.5 .5v.5a2 2 0 0 1 -2 2h-11a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2"/>',
  bolt: '<path d="M13 3l0 7h6l-8 11l0 -7h-6l8 -11"/>',
  activity: '<path d="M3 12h4l3 8l4 -16l3 8h4"/>',
  clock: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>'
})

export const TABLER_ICON_NAMES = Object.freeze(Object.keys(ICON_MARKUP))

export function tablerIconMarkup(name) {
  return ICON_MARKUP[Object.prototype.hasOwnProperty.call(ICON_MARKUP, name) ? name : 'box']
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/** 将图标输出为自包含 SVG，供非 Vue 图层（如 MapLibre）使用。 */
export function tablerIconSvg(name, { size = 24, stroke = 'currentColor', strokeWidth = 2, title = '' } = {}) {
  const safeTitle = title ? `<title>${escapeXml(title)}</title>` : ''
  const hidden = title ? 'false' : 'true'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Number(size) || 24}" height="${Number(size) || 24}" viewBox="0 0 24 24" fill="none" stroke="${escapeXml(stroke)}" stroke-width="${Number(strokeWidth) || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="${hidden}">${safeTitle}${tablerIconMarkup(name)}</svg>`
}

export function tablerIconDataUri(name, options) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tablerIconSvg(name, options))}`
}
