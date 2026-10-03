function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * 计算地图可视区域边距。
 * presentation=true 时，地图会避开对外展示屏两侧的自适应信息栏；
 * 普通工作台跟随分析栏、事件栏和移动端底部面板调整可视区域。
 */
export function getViewportPadding({
  width = globalThis.window?.innerWidth, height = globalThis.window?.innerHeight,
  presentation = false, panelVisible = true, mobileExpanded = false,
  eventsOpen = false, hasAttachments = false
} = {}) {
  const viewportWidth = Math.max(1, Number(width) || 1280)
  const viewportHeight = Math.max(1, Number(height) || 720)

  if (presentation) {
    const compactHeader = viewportHeight <= 720
    const header = viewportWidth <= 900 ? (viewportWidth <= 600 ? 94 : 82) : compactHeader ? 74 : clamp(Math.round(viewportHeight * 0.084), 74, 104)
    const gutter = viewportWidth <= 600 ? 12 : viewportWidth <= 1180 ? 18 : clamp(Math.round(viewportWidth * 0.0175), 18, 34)
    if (viewportWidth <= 900) {
      return { top: header + 12, right: gutter, bottom: Math.max(42, Math.round(viewportHeight * 0.06)), left: gutter }
    }
    if (viewportWidth <= 1180) {
      return { top: header + 12, right: gutter, bottom: Math.max(42, Math.round(viewportHeight * 0.06)), left: gutter }
    }
    const sidePanel = clamp(Math.round(viewportWidth * 0.19), 320, 410)
    const sidePadding = sidePanel + gutter + 12
    return { top: header + 12, right: sidePadding, bottom: Math.max(42, Math.round(viewportHeight * 0.055)), left: sidePadding }
  }

  const minimumVisibleHeight = Math.min(140, viewportHeight * 0.25)
  if (viewportWidth <= 600) {
    const top = Math.min(214, Math.round(viewportHeight * 0.4))
    const commandHeight = hasAttachments ? 144 : 78
    const panelHeight = panelVisible
      ? mobileExpanded
        ? Math.max(0, viewportHeight - (hasAttachments ? 316 : 250))
        : Math.round(viewportHeight * (hasAttachments ? 0.3 : 0.34))
      : 0
    const bottom = Math.max(0, Math.min(commandHeight + panelHeight + 12, viewportHeight - top - minimumVisibleHeight))
    return { top, right: 18, bottom, left: 18 }
  }
  const minimumVisibleWidth = Math.min(240, viewportWidth * 0.3)
  const left = panelVisible ? (viewportWidth <= 1180 ? 356 : 400) : 24
  const right = Math.max(0, Math.min(eventsOpen ? 336 : 72, viewportWidth - left - minimumVisibleWidth))
  const top = Math.min(138, Math.round(viewportHeight * 0.3))
  const bottom = Math.max(0, Math.min(hasAttachments ? 164 : 98, viewportHeight - top - minimumVisibleHeight))
  return { top, right, bottom, left }
}

export function syncMapViewport(targetMap, options) {
  const padding = getViewportPadding(options)
  targetMap?.resize?.()
  targetMap?.setPadding?.(padding)
  return padding
}
