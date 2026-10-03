/**
 * 数字孪生对象的预警与摄像头观测视图模型。
 *
 * 约束：演示数据必须显式标注；外部媒体默认拒绝；网关消息采用受限字段集，
 * 避免把未知字段、无限长文本或过期视频误当成现场实时结果。
 */

export const TWIN_ALERT_LEVEL_LABELS = Object.freeze({
  warning: '高风险',
  attention: '需关注',
  normal: '正常',
  pending: '待接入'
})

export const TWIN_CAMERA_STATUS_LABELS = Object.freeze({
  online: '在线',
  alarm: '识别异常',
  offline: '离线',
  maintenance: '维护中',
  pending: '状态待确认',
  demo: '演示数据',
  unbound: '未绑定'
})

export const MAX_TWIN_OBSERVATIONS = 200

export const TWIN_OBSERVATION_FIELDS = Object.freeze([
  'twin_alert_level', 'twin_alert_count', 'twin_alert_title', 'twin_alert_detail',
  'twin_alert_advice', 'twin_alert_observed_at', 'camera_id', 'camera_name',
  'camera_status', 'camera_stream_url', 'camera_snapshot_url', 'camera_media_kind',
  'camera_result', 'camera_confidence', 'camera_metric_1', 'camera_metric_2',
  'camera_metric_3', 'camera_observed_at', 'camera_source', 'observation_source',
  'twin_alert_cleared', 'camera_media_cleared', 'camera_result_cleared',
  'camera_metrics_cleared', 'observation_transport_status'
])

const OBSERVATION_TEMPLATES = Object.freeze({
  '水产塘口': {
    cameraName: '塘口智能观测相机',
    normalResult: '水面平稳 · 鱼群活动正常',
    warningResult: '鱼群活动偏弱 · 未识别漂浮异物',
    metrics: ['鱼群活动 83%', '漂浮异物 0', '人员识别 0'],
    alertTitle: '溶氧下行预警',
    alertDetail: '夜间溶氧趋势低于演示阈值 5.0 mg/L',
    advice: '复核增氧机与溶氧探头，必要时人工开启增氧'
  },
  '种植地块': {
    alertTitle: '叶面异常扩散关注',
    alertDetail: '边缘行连续识别到叶色差异',
    advice: '建议现场巡检并复核病虫害模型结果'
  },
  '温室设施': {
    alertTitle: '高温闷棚风险',
    alertDetail: '棚内温度与湿度趋势叠加超过演示阈值',
    advice: '复核顶窗通风与遮阳设备状态'
  },
  '园区水系': {
    alertTitle: '水位上升关注',
    alertDetail: '连续观测到水位变化高于演示基线',
    advice: '复核闸口、排水通道与岸线状态'
  },
  '生态绿地': {
    alertTitle: '植被异常关注',
    alertDetail: '局部色差连续高于演示基线',
    advice: '复核灌溉覆盖与植被健康状态'
  },
  '建筑体量': {
    alertTitle: '非作业时段停留',
    alertDetail: '出入口相机连续检测到人员停留',
    advice: '请值守人员复核画面与访客授权记录'
  }
})

const FALLBACK_TEMPLATE = OBSERVATION_TEMPLATES['种植地块']

// 仅为演示汇报保留一个明确样例；其他空间对象默认显示“未绑定”。
const DEMO_OBSERVATION_OVERRIDES = Object.freeze({
  'POND-062': Object.freeze({
    alertLevel: 'warning',
    alertCount: 1,
    alertTitle: '溶氧下行预警',
    alertDetail: '夜间溶氧趋势低于演示阈值 5.0 mg/L',
    alertAdvice: '复核增氧机与溶氧探头，必要时人工开启增氧',
    cameraName: '62 号塘口智能观测相机',
    cameraResult: '鱼群活动偏弱 · 未识别漂浮异物',
    cameraMetrics: ['鱼群活动 72%', '漂浮异物 0', '人员识别 0']
  })
})

const FIELD_LIMITS = Object.freeze({
  twin_alert_level: 16,
  twin_alert_title: 120,
  twin_alert_detail: 500,
  twin_alert_advice: 300,
  twin_alert_observed_at: 80,
  camera_id: 64,
  camera_name: 120,
  camera_status: 20,
  camera_stream_url: 2048,
  camera_snapshot_url: 2048,
  camera_media_kind: 16,
  camera_result: 500,
  camera_metric_1: 100,
  camera_metric_2: 100,
  camera_metric_3: 100,
  camera_observed_at: 80,
  camera_source: 120,
  observation_source: 120,
  observation_transport_status: 20
})

const NUMERIC_FIELDS = new Set(['twin_alert_count', 'camera_confidence'])
const BOOLEAN_FIELDS = new Set([
  'twin_alert_cleared', 'camera_media_cleared', 'camera_result_cleared',
  'camera_metrics_cleared'
])

function text(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function boundedText(value, limit = 500) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, limit)
}

function number(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : fallback
}

function ordinalFromId(id) {
  const match = String(id || '').match(/(\d+)$/)
  return match ? Number(match[1]) : 0
}

function hasOwn(target, key) {
  return Object.prototype.hasOwnProperty.call(target, key)
}

export function normalizeTwinId(value) {
  const candidate = String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .trim()
  if (candidate.length > 64) return ''
  if (['__proto__', 'prototype', 'constructor'].includes(candidate.toLowerCase())) return ''
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(candidate) ? candidate : ''
}

function inferredAlertLevel(properties, fallback = 'normal') {
  const explicit = text(properties.twin_alert_level || properties.alert_level).toLowerCase()
  if (hasOwn(TWIN_ALERT_LEVEL_LABELS, explicit)) return explicit
  return hasOwn(TWIN_ALERT_LEVEL_LABELS, fallback) ? fallback : 'normal'
}

function inferredCameraStatus(properties, fallback = 'unbound') {
  const explicit = text(properties.camera_status).toLowerCase()
  if (hasOwn(TWIN_CAMERA_STATUS_LABELS, explicit)) return explicit
  return hasOwn(TWIN_CAMERA_STATUS_LABELS, fallback) ? fallback : 'unbound'
}

/**
 * 默认只允许同源 http(s)；跨域媒体必须为 HTTPS 且命中显式白名单。
 * blob/data/javascript、协议相对地址、带凭据 URL 与 HTTPS 页面的混合内容均拒绝。
 */
export function normalizeTwinMediaUrl(value, baseUrl = 'http://localhost/', allowedOrigins = []) {
  const candidate = boundedText(value, 2048)
  if (!candidate || candidate.startsWith('\\') || candidate.startsWith('//')) return ''
  try {
    const base = new URL(baseUrl)
    const parsed = new URL(candidate, base)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return ''
    if (base.protocol === 'https:' && parsed.protocol !== 'https:') return ''
    const originValues = Array.isArray(allowedOrigins)
      ? allowedOrigins
      : String(allowedOrigins || '').split(',')
    const trustedOrigins = new Set(originValues.flatMap((origin) => {
      try {
        const parsedOrigin = new URL(String(origin).trim())
        return parsedOrigin.protocol === 'https:' ? [parsedOrigin.origin] : []
      } catch {
        return []
      }
    }))
    if (parsed.origin !== base.origin && !(parsed.protocol === 'https:' && trustedOrigins.has(parsed.origin))) return ''
    return candidate
  } catch {
    return ''
  }
}

function sanitizeField(key, value) {
  if (BOOLEAN_FIELDS.has(key)) return value === true
  if (NUMERIC_FIELDS.has(key)) {
    if (value === null || value === '') return null
    const normalized = number(value)
    if (normalized === null) return undefined
    if (key === 'camera_confidence') return Math.max(0, Math.min(100, normalized))
    return Math.max(0, Math.min(9999, Math.trunc(normalized)))
  }
  return boundedText(value, FIELD_LIMITS[key] || 500)
}

function assignField(target, key, value) {
  if (value === undefined) return
  const sanitized = sanitizeField(key, value)
  if (sanitized !== undefined) target[key] = sanitized
}

export function twinObservationUpdateMode(payload = {}) {
  const nested = payload?.observation && typeof payload.observation === 'object' ? payload.observation : null
  const raw = text(
    payload.observation_mode || payload.update_mode || payload.mode ||
    nested?.observation_mode || nested?.update_mode || nested?.mode
  ).toLowerCase()
  return raw === 'snapshot' ? 'snapshot' : 'patch'
}

export function twinObservationPropertyPatch(payload = {}) {
  if (!payload || typeof payload !== 'object') return {}
  const alert = payload.alert && typeof payload.alert === 'object' ? payload.alert : {}
  const camera = payload.camera && typeof payload.camera === 'object' ? payload.camera : {}
  const patch = {}

  for (const key of TWIN_OBSERVATION_FIELDS) {
    if (hasOwn(payload, key)) assignField(patch, key, payload[key])
  }

  const aliases = [
    [alert, 'level', 'twin_alert_level'],
    [alert, 'count', 'twin_alert_count'],
    [alert, 'title', 'twin_alert_title'],
    [alert, 'detail', 'twin_alert_detail'],
    [alert, 'advice', 'twin_alert_advice'],
    [camera, 'id', 'camera_id'],
    [camera, 'name', 'camera_name'],
    [camera, 'status', 'camera_status'],
    [camera, 'result', 'camera_result'],
    [camera, 'confidence', 'camera_confidence'],
    [camera, 'source', 'camera_source']
  ]
  for (const [source, sourceKey, targetKey] of aliases) {
    if (hasOwn(source, sourceKey)) assignField(patch, targetKey, source[sourceKey])
  }

  if (hasOwn(alert, 'observed_at') || hasOwn(alert, 'observedAt')) {
    assignField(patch, 'twin_alert_observed_at', alert.observed_at ?? alert.observedAt)
  }
  if (hasOwn(camera, 'stream_url') || hasOwn(camera, 'streamUrl')) {
    assignField(patch, 'camera_stream_url', camera.stream_url ?? camera.streamUrl)
  }
  if (hasOwn(camera, 'snapshot_url') || hasOwn(camera, 'snapshotUrl')) {
    assignField(patch, 'camera_snapshot_url', camera.snapshot_url ?? camera.snapshotUrl)
  }
  if (hasOwn(camera, 'media_kind') || hasOwn(camera, 'mediaKind')) {
    assignField(patch, 'camera_media_kind', camera.media_kind ?? camera.mediaKind)
  }
  if (hasOwn(camera, 'observed_at') || hasOwn(camera, 'observedAt')) {
    assignField(patch, 'camera_observed_at', camera.observed_at ?? camera.observedAt)
  }
  if (Array.isArray(camera.metrics)) {
    camera.metrics.slice(0, 3).forEach((metric, index) => assignField(patch, `camera_metric_${index + 1}`, metric))
  }

  if (!hasOwn(payload, 'twin_alert_cleared') && Object.keys(patch).some((key) => key.startsWith('twin_alert_') && key !== 'twin_alert_cleared')) patch.twin_alert_cleared = false
  if (!hasOwn(payload, 'camera_media_cleared') && Object.keys(patch).some((key) => ['camera_stream_url', 'camera_snapshot_url', 'camera_media_kind'].includes(key))) patch.camera_media_cleared = false
  if (!hasOwn(payload, 'camera_result_cleared') && Object.keys(patch).some((key) => ['camera_result', 'camera_confidence'].includes(key))) patch.camera_result_cleared = false
  if (!hasOwn(payload, 'camera_metrics_cleared') && Object.keys(patch).some((key) => /^camera_metric_[123]$/.test(key))) patch.camera_metrics_cleared = false

  if (payload.clear_camera_media === true || camera.clear_media === true) {
    patch.camera_stream_url = ''
    patch.camera_snapshot_url = ''
    patch.camera_media_kind = ''
    patch.camera_media_cleared = true
  }
  if (payload.clear_alert === true || alert.clear === true) {
    patch.twin_alert_level = 'normal'
    patch.twin_alert_count = 0
    patch.twin_alert_title = ''
    patch.twin_alert_detail = ''
    patch.twin_alert_advice = ''
    patch.twin_alert_observed_at = ''
    patch.twin_alert_cleared = true
  }
  if (payload.clear_camera_result === true || camera.clear_result === true) {
    patch.camera_result = ''
    patch.camera_confidence = null
    patch.camera_result_cleared = true
  }
  if (payload.clear_camera_metrics === true || camera.clear_metrics === true) {
    patch.camera_metric_1 = ''
    patch.camera_metric_2 = ''
    patch.camera_metric_3 = ''
    patch.camera_metrics_cleared = true
  }
  if (payload.clear_camera === true || camera.clear === true) {
    Object.assign(patch, {
      camera_id: '',
      camera_name: '',
      camera_status: 'unbound',
      camera_stream_url: '',
      camera_snapshot_url: '',
      camera_media_kind: '',
      camera_result: '',
      camera_confidence: null,
      camera_metric_1: '',
      camera_metric_2: '',
      camera_metric_3: '',
      camera_observed_at: '',
      camera_source: '',
      camera_media_cleared: true,
      camera_result_cleared: true,
      camera_metrics_cleared: true
    })
  }

  return patch
}

export function applyTwinObservationUpdate(target = {}, payload = {}, mode = twinObservationUpdateMode(payload)) {
  if (mode === 'snapshot') {
    for (const key of TWIN_OBSERVATION_FIELDS) delete target[key]
  }
  Object.assign(target, twinObservationPropertyPatch(payload))
  return target
}

export function mergeTwinObservationRecord(previous = {}, payload = {}, source = 'farmclaw') {
  if (!payload || typeof payload !== 'object') return null
  const nested = payload.observation && typeof payload.observation === 'object' ? payload.observation : null
  const update = nested
    ? {
        ...nested,
        twin_id: nested.twin_id || nested.twinId || payload.twin_id || payload.twinId,
        observation_mode: nested.observation_mode || nested.update_mode || nested.mode || payload.observation_mode || payload.update_mode || payload.mode,
        source_node: nested.source_node || payload.source_node || source
      }
    : payload
  for (const key of ['clear_alert', 'clear_camera', 'clear_camera_media', 'clear_camera_result', 'clear_camera_metrics']) {
    if (payload[key] === true && update[key] === undefined) update[key] = true
  }
  const twinId = normalizeTwinId(update.twin_id || update.twinId || previous.twin_id)
  if (!twinId) return null
  const mode = twinObservationUpdateMode(update)
  const next = mode === 'snapshot' ? { twin_id: twinId } : { ...previous, twin_id: twinId }
  applyTwinObservationUpdate(next, update, mode)
  next.observation_mode = mode
  next.source_node = boundedText(update.source_node || source, 120) || 'farmclaw'
  if (!next.observation_source) next.observation_source = 'farmclaw-gateway'
  const updatePatch = twinObservationPropertyPatch(update)
  const includesCameraData = Object.keys(updatePatch).some((key) => key.startsWith('camera_') && !key.endsWith('_cleared'))
  const cameraCleared = update.clear_camera === true || update.camera?.clear === true
  if (includesCameraData && !cameraCleared && !next.camera_source) next.camera_source = next.source_node
  return next
}

export function twinObservationHasAlert(observation = {}) {
  const level = text(observation.alert?.level || observation.twin_alert_level).toLowerCase()
  const count = number(observation.alert?.count ?? observation.twin_alert_count, 0)
  return ['warning', 'attention'].includes(level) || count > 0
}

function mediaKindFor(url, explicitKind = '') {
  const normalized = text(explicitKind).toLowerCase()
  if (['image', 'video'].includes(normalized)) return normalized
  return /\.(?:jpe?g|png|webp|gif|mjpg|mjpeg)(?:[?#]|$)/i.test(url) ? 'image' : 'video'
}

function freshnessFor(observedAt, now, maxAgeMs) {
  const observedAtMs = Date.parse(observedAt)
  if (!Number.isFinite(observedAtMs)) return { isFresh: false, ageMs: null, label: '未提供观测时间' }
  const ageMs = Number(now) - observedAtMs
  if (ageMs < -30_000) return { isFresh: false, ageMs, label: '观测时间异常' }
  if (ageMs > maxAgeMs) return { isFresh: false, ageMs, label: '数据已过期' }
  if (ageMs < 60_000) return { isFresh: true, ageMs, label: '刚刚更新' }
  return { isFresh: true, ageMs, label: `${Math.max(1, Math.round(ageMs / 60_000))} 分钟前更新` }
}

export function buildTwinObservation(properties = {}, {
  baseUrl = globalThis.location?.href || 'http://localhost/',
  allowedMediaOrigins = [],
  now = Date.now(),
  liveMaxAgeMs = 2 * 60 * 1000
} = {}) {
  const id = text(properties.twin_id, 'TWIN-UNKNOWN')
  const type = text(properties.twin_type, '空间对象')
  const template = OBSERVATION_TEMPLATES[type] || FALLBACK_TEMPLATE
  const demo = DEMO_OBSERVATION_OVERRIDES[id] || null
  const rawStreamUrl = text(properties.camera_stream_url)
  const rawSnapshotUrl = text(properties.camera_snapshot_url)
  const streamUrl = normalizeTwinMediaUrl(rawStreamUrl, baseUrl, allowedMediaOrigins)
  const snapshotUrl = normalizeTwinMediaUrl(rawSnapshotUrl, baseUrl, allowedMediaOrigins)
  const mediaRejected = Boolean((rawStreamUrl && !streamUrl) || (rawSnapshotUrl && !snapshotUrl))
  const hasObservationInput = TWIN_OBSERVATION_FIELDS.some((key) =>
    !key.endsWith('_cleared') && hasOwn(properties, key) && properties[key] !== '' && properties[key] !== null && properties[key] !== undefined
  )
  const observationSource = text(properties.observation_source, demo && !hasObservationInput ? 'demo-twin-observation' : 'unbound')
  const isDemo = observationSource.startsWith('demo-')
  const hasDemoScenario = isDemo && Boolean(demo)
  const observationUnbound = observationSource === 'unbound'
  const alertCleared = properties.twin_alert_cleared === true
  const cameraResultCleared = properties.camera_result_cleared === true
  const cameraMetricsCleared = properties.camera_metrics_cleared === true
  const alertLevel = alertCleared
    ? 'normal'
    : inferredAlertLevel(properties, hasDemoScenario ? demo.alertLevel : observationUnbound ? 'pending' : 'normal')
  const warning = ['warning', 'attention'].includes(alertLevel)
  const alertCount = alertCleared ? 0 : number(
    properties.twin_alert_count ?? properties.alert_count,
    hasDemoScenario ? number(demo.alertCount, warning ? 1 : 0) : warning ? 1 : 0
  )
  const hasRealCameraSignal = !isDemo && Boolean(text(
    properties.camera_id || properties.camera_name || properties.camera_result ||
    properties.camera_source || properties.camera_status || rawStreamUrl || rawSnapshotUrl
  ))
  const cameraStatus = inferredCameraStatus(properties, hasDemoScenario ? 'demo' : hasRealCameraSignal ? 'pending' : 'unbound')
  const ordinal = ordinalFromId(id)
  const confidenceFallback = hasDemoScenario ? 94 - (ordinal % 9) : null
  const confidenceValue = cameraResultCleared ? null : number(properties.camera_confidence, confidenceFallback)
  const confidence = confidenceValue == null ? null : Math.max(0, Math.min(100, confidenceValue))
  const cameraObservedAt = text(properties.camera_observed_at, hasDemoScenario ? '演示样例 · 非现场实时流' : '未提供观测时间')
  const freshness = freshnessFor(cameraObservedAt, now, liveMaxAgeMs)
  // 设备在线或仅识别结果告警、时间戳新鲜且媒体地址可信，才有资格进入实时流状态。
  const transportOffline = text(properties.observation_transport_status).toLowerCase() === 'offline'
  const liveEligible = Boolean(streamUrl) && !transportOffline && ['online', 'alarm'].includes(cameraStatus) && freshness.isFresh
  const hasRealResult = !isDemo && Boolean(text(properties.camera_result))

  let feedMode = 'unbound'
  let feedLabel = '未接入画面'
  let feedHint = '绑定摄像头后可显示视频或快照'
  let fallbackTitle = '未绑定摄像头'
  let mediaUrl = ''
  if (liveEligible) {
    feedMode = 'live'
    feedLabel = '视频流连接中'
    feedHint = '画面开始播放后才会标记 LIVE'
    fallbackTitle = '视频流正在连接'
    mediaUrl = streamUrl
  } else if (snapshotUrl) {
    feedMode = 'snapshot'
    feedLabel = transportOffline
      ? '网关断开·最后快照'
      : cameraStatus === 'offline'
      ? '离线前快照'
      : freshness.ageMs === null
        ? '静态快照·时间未知'
        : !freshness.isFresh ? '历史快照' : '最新快照'
    feedHint = '当前显示可信来源的静态观测画面'
    mediaUrl = snapshotUrl
  } else if (streamUrl) {
    feedMode = transportOffline || (freshness.ageMs !== null && !freshness.isFresh) ? 'stale' : 'offline'
    feedLabel = feedMode === 'stale'
      ? transportOffline ? '网关断开·最后状态' : '视频流·数据过期'
      : `视频流·${TWIN_CAMERA_STATUS_LABELS[cameraStatus]}`
    feedHint = '状态恢复且收到新鲜时间戳后才显示实时画面'
    fallbackTitle = feedMode === 'stale' ? '实时画面已过期' : '摄像头当前不可用'
  } else if (mediaRejected) {
    feedMode = 'blocked'
    feedLabel = '媒体地址已拦截'
    feedHint = '仅允许同源媒体或白名单内的 HTTPS 来源'
    fallbackTitle = '不受信任的媒体地址'
  } else if (hasDemoScenario) {
    feedMode = 'demo'
    feedLabel = '演示识别'
    feedHint = '真实视频流未接入'
    fallbackTitle = '真实视频流未接入'
  } else if (hasRealResult) {
    feedMode = 'result'
    feedLabel = transportOffline ? '网关断开·最后识别' : freshness.isFresh ? '最新识别' : '识别结果'
    feedHint = '上游未提供可展示的视频或快照'
    fallbackTitle = '未提供可展示画面'
  } else if (hasRealCameraSignal && cameraStatus !== 'unbound') {
    feedMode = 'status'
    feedLabel = transportOffline ? '网关断开·仅设备状态' : '仅设备状态'
    feedHint = '摄像头已绑定，但上游未提供可展示的视频或快照'
    fallbackTitle = '未提供可展示画面'
  }

  const resultFallback = cameraResultCleared
    ? '上游已清除本次识别结论'
    : hasDemoScenario
    ? text(demo.cameraResult, warning ? template.warningResult : template.normalResult)
    : cameraStatus === 'unbound'
      ? '尚未绑定摄像头或视觉识别服务'
      : '上游未提供识别结论'
  const metrics = cameraMetricsCleared
    ? []
    : hasDemoScenario
    ? (demo.cameraMetrics || template.metrics || [])
    : [properties.camera_metric_1, properties.camera_metric_2, properties.camera_metric_3]
      .map((metric) => text(metric))
      .filter(Boolean)
  const alertFallback = hasDemoScenario
    ? {
        title: text(demo.alertTitle, warning ? template.alertTitle : '当前无活动预警'),
        detail: text(demo.alertDetail, warning ? template.alertDetail : '未发现超出演示阈值的异常趋势'),
        advice: text(demo.alertAdvice, warning ? template.advice : '保持常规巡检与数据复核')
      }
    : observationUnbound
      ? { title: '预警状态待接入', detail: '尚未绑定观测源，无法判断当前状态', advice: '完成传感器或业务规则绑定后再进行判断' }
    : warning
      ? { title: '上游预警（标题未提供）', detail: '上游未提供预警判断依据', advice: '请人工复核对象状态与现场数据' }
      : { title: '当前无活动预警', detail: isDemo ? '该对象未配置演示预警' : '上游未提供活动预警', advice: '保持常规巡检与数据复核' }

  return {
    source: observationSource,
    isDemo,
    hasDemoScenario,
    observationUnbound,
    alert: {
      count: Math.max(0, Math.trunc(alertCount)),
      level: alertLevel,
      levelLabel: TWIN_ALERT_LEVEL_LABELS[alertLevel],
      title: alertCleared ? '当前无活动预警' : text(properties.twin_alert_title || properties.alert_title, alertFallback.title),
      detail: alertCleared ? '上游已清除上一条活动预警' : text(properties.twin_alert_detail || properties.alert_detail, alertFallback.detail),
      advice: alertCleared ? '保持常规巡检与数据复核' : text(properties.twin_alert_advice || properties.alert_advice, alertFallback.advice),
      observedAt: alertCleared ? '最近一次网关更新' : text(properties.twin_alert_observed_at || properties.alert_observed_at, isDemo ? '演示规则 · 最近评估' : '上游未提供评估时间')
    },
    camera: {
      id: text(properties.camera_id, hasDemoScenario ? `CAM-${id}` : '--'),
      name: text(properties.camera_name, hasDemoScenario ? demo.cameraName : hasRealCameraSignal ? '摄像头信息未提供' : '未绑定摄像头'),
      status: transportOffline ? 'pending' : cameraStatus,
      rawStatus: cameraStatus,
      statusLabel: transportOffline ? '网关断开·状态待确认' : TWIN_CAMERA_STATUS_LABELS[cameraStatus],
      feedMode,
      feedLabel,
      feedHint,
      fallbackTitle,
      hasDemoScenario,
      liveEligible,
      isFresh: freshness.isFresh,
      freshnessLabel: freshness.label,
      liveExpiresAt: liveEligible ? Date.parse(cameraObservedAt) + liveMaxAgeMs : null,
      mediaRejected,
      mediaUrl,
      streamUrl,
      snapshotUrl,
      // stream_url 一律按视频处理，避免伪装成 jpg 的流在图片 load 后误标 LIVE；静态图只走 snapshot_url。
      mediaKind: feedMode === 'snapshot' ? 'image' : feedMode === 'live' ? 'video' : mediaKindFor(mediaUrl, properties.camera_media_kind),
      result: text(properties.camera_result, resultFallback),
      confidence,
      metrics,
      observedAt: cameraObservedAt,
      source: text(properties.camera_source, hasDemoScenario ? 'demo-camera-analysis' : cameraStatus === 'unbound' ? 'unbound' : 'camera-gateway')
    }
  }
}
