import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  applyTwinObservationUpdate,
  buildTwinObservation,
  mergeTwinObservationRecord,
  normalizeTwinId,
  normalizeTwinMediaUrl,
  twinObservationHasAlert,
  twinObservationPropertyPatch
} from '../src/utils/twinObservation.js'
import { useFarmclawBridge } from '../src/composables/useFarmclawBridge.js'

const NOW = Date.parse('2026-09-02T17:30:00+08:00')

const pond = buildTwinObservation({ twin_id: 'POND-062', twin_type: '水产塘口' }, { now: NOW })
assert.equal(pond.alert.level, 'warning', 'POND-062 演示对象应呈现可读预警')
assert.equal(pond.alert.count, 1)
assert.equal(pond.alert.title, '溶氧下行预警')
assert.equal(pond.camera.id, 'CAM-POND-062')
assert.equal(pond.camera.status, 'demo')
assert.equal(pond.camera.feedMode, 'demo')
assert.equal(pond.camera.liveEligible, false, '无视频地址时不得尝试实时流')
assert.equal(pond.camera.feedLabel, '演示识别')
assert.equal(pond.camera.metrics.length, 3)
assert.match(pond.camera.result, /鱼群活动/)

const unbound = buildTwinObservation({ twin_id: 'FIELD-013', twin_type: '种植地块' }, { now: NOW })
assert.equal(unbound.isDemo, false, '未绑定对象不得自动继承演示来源')
assert.equal(unbound.camera.status, 'unbound')
assert.equal(unbound.camera.id, '--')
assert.equal(unbound.camera.confidence, null)
assert.equal(unbound.camera.feedMode, 'unbound')
assert.match(unbound.camera.result, /尚未绑定/)
assert.equal(unbound.alert.level, 'pending', '未绑定观测源不得把无数据解释为正常')
assert.equal(unbound.alert.title, '预警状态待接入')
assert.equal(unbound.alert.observedAt, '上游未提供评估时间')

const live = buildTwinObservation({
  twin_id: 'POND-062',
  twin_type: '水产塘口',
  observation_source: 'camera-edge',
  twin_alert_level: 'attention',
  twin_alert_count: 2,
  twin_alert_title: '水质波动',
  camera_status: 'online',
  camera_stream_url: 'https://media.example.test/pond-062/live.m3u8',
  camera_result: '水面无异常',
  camera_confidence: 97,
  camera_observed_at: '2026-09-02T17:30:00+08:00'
}, { now: NOW, allowedMediaOrigins: ['https://media.example.test'] })
assert.equal(live.alert.level, 'attention')
assert.equal(live.alert.count, 2)
assert.equal(live.alert.title, '水质波动')
assert.equal(live.camera.feedMode, 'live')
assert.equal(live.camera.liveEligible, true)
assert.equal(live.camera.mediaKind, 'video')
assert.equal(live.camera.confidence, 97)
const streamNamedAsImage = buildTwinObservation({
  twin_id: 'POND-066', twin_type: '水产塘口', observation_source: 'camera-edge', camera_status: 'online',
  camera_stream_url: '/camera/live.jpg', camera_media_kind: 'image', camera_observed_at: '2026-09-02T17:30:00+08:00'
}, { now: NOW })
assert.equal(streamNamedAsImage.camera.mediaKind, 'video', 'stream_url 不得通过图片 load 冒充 LIVE')

const alarmStream = buildTwinObservation({
  twin_id: 'POND-063', twin_type: '水产塘口', observation_source: 'camera-edge',
  camera_status: 'alarm', camera_stream_url: 'https://media.example.test/alarm.webm',
  camera_observed_at: '2026-09-02T17:29:30+08:00'
}, { now: NOW, allowedMediaOrigins: ['https://media.example.test'] })
assert.equal(alarmStream.camera.liveEligible, true, '识别异常但在线的摄像头仍应允许实时复核')

const stale = buildTwinObservation({
  twin_id: 'POND-063', twin_type: '水产塘口', observation_source: 'camera-edge',
  camera_status: 'online', camera_stream_url: 'https://media.example.test/stale.m3u8',
  camera_observed_at: '2026-09-02T17:20:00+08:00'
}, { now: NOW, allowedMediaOrigins: ['https://media.example.test'] })
assert.equal(stale.camera.liveEligible, false)
assert.equal(stale.camera.feedMode, 'stale')

const disconnected = buildTwinObservation({
  twin_id: 'POND-063', twin_type: '水产塘口', observation_source: 'camera-edge',
  observation_transport_status: 'offline', camera_status: 'online',
  camera_stream_url: 'https://media.example.test/live.m3u8', camera_snapshot_url: '/camera/last.jpg',
  camera_result: '断网前识别', camera_observed_at: '2026-09-02T17:29:30+08:00'
}, { now: NOW, allowedMediaOrigins: ['https://media.example.test'] })
assert.equal(disconnected.camera.liveEligible, false)
assert.equal(disconnected.camera.status, 'pending')
assert.equal(disconnected.camera.statusLabel, '网关断开·状态待确认')
assert.equal(disconnected.camera.feedLabel, '网关断开·最后快照')

const offline = buildTwinObservation({
  twin_id: 'POND-064', twin_type: '水产塘口', observation_source: 'camera-edge',
  camera_status: 'offline', camera_stream_url: 'https://media.example.test/offline.m3u8',
  camera_snapshot_url: '/camera/pond-064.jpg', camera_observed_at: '2026-09-02T17:29:00+08:00'
}, { now: NOW, allowedMediaOrigins: ['https://media.example.test'] })
assert.equal(offline.camera.liveEligible, false)
assert.equal(offline.camera.feedMode, 'snapshot', '离线时应优先保留可信快照')
assert.equal(offline.camera.feedLabel, '离线前快照')

const unknownSnapshot = buildTwinObservation({
  twin_id: 'GH-001', twin_type: '温室设施', observation_source: 'camera-edge',
  camera_status: 'online', camera_snapshot_url: '/camera/gh-001/latest.jpg'
}, { now: NOW })
assert.equal(unknownSnapshot.camera.feedMode, 'snapshot')
assert.equal(unknownSnapshot.camera.feedLabel, '静态快照·时间未知')

const resultOnly = buildTwinObservation({
  twin_id: 'POND-062', twin_type: '水产塘口', observation_source: 'camera-edge', camera_source: 'vision-model',
  camera_status: 'online', camera_result: '鱼群活动正常', camera_confidence: 91
}, { now: NOW })
assert.equal(resultOnly.isDemo, false)
assert.equal(resultOnly.alert.level, 'normal', '真实消息缺少预警字段时不得回填演示预警')
assert.equal(resultOnly.camera.feedMode, 'result')
assert.equal(resultOnly.camera.feedLabel, '识别结果')
assert.equal(resultOnly.camera.confidence, 91)

const resultWithoutConfidence = buildTwinObservation({
  twin_id: 'POND-062', twin_type: '水产塘口', observation_source: 'camera-edge', camera_source: 'vision-model',
  camera_status: 'online', camera_result: '鱼群活动正常'
}, { now: NOW })
assert.equal(resultWithoutConfidence.camera.confidence, null, '真实上游未给置信度时不得生成演示数值')

const boundWithoutVisualPayload = buildTwinObservation({
  twin_id: 'POND-062', twin_type: '水产塘口', observation_source: 'camera-edge',
  camera_id: 'CAM-062', camera_name: '62号塘口相机', camera_status: 'online',
  camera_media_cleared: true, camera_result_cleared: true
}, { now: NOW })
assert.equal(boundWithoutVisualPayload.camera.feedMode, 'status', '已绑定摄像头缺少画面时不得误报为未绑定')
assert.equal(boundWithoutVisualPayload.camera.feedLabel, '仅设备状态')
assert.equal(boundWithoutVisualPayload.camera.fallbackTitle, '未提供可展示画面')
assert.match(boundWithoutVisualPayload.camera.feedHint, /摄像头已绑定/)

const realWarningWithoutEvidence = buildTwinObservation({
  twin_id: 'POND-065', twin_type: '水产塘口', observation_source: 'camera-edge',
  twin_alert_level: 'warning', camera_status: 'online'
}, { now: NOW })
assert.equal(realWarningWithoutEvidence.alert.title, '上游预警（标题未提供）')
assert.equal(realWarningWithoutEvidence.alert.detail, '上游未提供预警判断依据')

assert.equal(normalizeTwinMediaUrl('javascript:alert(1)'), '')
assert.equal(normalizeTwinMediaUrl('blob:https://media.example.test/abc', 'https://app.example.test/'), '')
assert.equal(normalizeTwinMediaUrl('//media.example.test/live.m3u8', 'https://app.example.test/'), '')
assert.equal(normalizeTwinMediaUrl('http://media.example.test/live.m3u8', 'https://app.example.test/', ['https://media.example.test']), '')
assert.equal(normalizeTwinMediaUrl('https://media.example.test/live.m3u8', 'https://app.example.test/', ['https://media.example.test']), 'https://media.example.test/live.m3u8')
assert.equal(normalizeTwinMediaUrl('/camera/latest.jpg', 'http://localhost/'), '/camera/latest.jpg')
assert.equal(normalizeTwinId('constructor'), '')
assert.equal(normalizeTwinId('__proto__'), '')
assert.equal(normalizeTwinId('A'.repeat(65)), '', '超长对象编号必须拒绝，不能截断后覆盖其他对象')
assert.equal(normalizeTwinId('POND-062'), 'POND-062')

assert.deepEqual(twinObservationPropertyPatch({
  alert: { level: 'warning', count: 2, title: '水质异常' },
  camera: { id: 'CAM-062', status: 'online', stream_url: 'https://media.example.test/live.webm', metrics: ['鱼群 12', '异物 0'] },
  unrelated: '<script>bad()</script>'
}), {
  twin_alert_level: 'warning',
  twin_alert_count: 2,
  twin_alert_title: '水质异常',
  twin_alert_cleared: false,
  camera_id: 'CAM-062',
  camera_status: 'online',
  camera_stream_url: 'https://media.example.test/live.webm',
  camera_media_cleared: false,
  camera_metric_1: '鱼群 12',
  camera_metric_2: '异物 0',
  camera_metrics_cleared: false
}, '上游观测消息必须只映射受支持字段')

assert.deepEqual(twinObservationPropertyPatch({ camera: { clear_media: true } }), {
  camera_stream_url: '', camera_snapshot_url: '', camera_media_kind: '', camera_media_cleared: true
}, '摄像头解绑时必须能够清除旧媒体地址')
assert.deepEqual(twinObservationPropertyPatch({ clear_alert: true }), {
  twin_alert_level: 'normal', twin_alert_count: 0, twin_alert_title: '', twin_alert_detail: '',
  twin_alert_advice: '', twin_alert_observed_at: '', twin_alert_cleared: true
}, '清除预警必须带显式清除标记')

const merged = mergeTwinObservationRecord(
  { twin_id: 'POND-070', observation_source: 'camera-edge', camera_status: 'online', camera_result: '旧结论', camera_metric_1: '旧指标' },
  { twin_id: 'POND-070', camera: { result: '新结论' } }, 'gateway-a'
)
assert.equal(merged.camera_result, '新结论')
assert.equal(merged.camera_metric_1, '旧指标', 'patch 模式必须保留未传字段')

const cleared = mergeTwinObservationRecord(merged, { twin_id: 'POND-070', clear_camera_result: true, clear_camera_metrics: true }, 'gateway-a')
const clearedView = buildTwinObservation(cleared, { now: NOW })
assert.equal(clearedView.camera.confidence, null)
assert.deepEqual(clearedView.camera.metrics, [])
const roundTripProperties = { twin_id: 'POND-070', twin_type: '水产塘口' }
applyTwinObservationUpdate(roundTripProperties, cleared)
const roundTripView = buildTwinObservation(roundTripProperties, { now: NOW })
assert.equal(roundTripView.camera.result, '上游已清除本次识别结论')
assert.deepEqual(roundTripView.camera.metrics, [], 'bridge 扁平记录经地图字段映射后必须保留清除语义')

const alertCleared = mergeTwinObservationRecord(
  { twin_id: 'POND-062', observation_source: 'camera-edge', twin_alert_level: 'warning', twin_alert_title: '旧预警' },
  { twin_id: 'POND-062', clear_alert: true }, 'gateway-a'
)
const alertRoundTrip = { twin_id: 'POND-062', twin_type: '水产塘口' }
applyTwinObservationUpdate(alertRoundTrip, alertCleared)
assert.equal(buildTwinObservation(alertRoundTrip, { now: NOW }).alert.detail, '上游已清除上一条活动预警')

const snapshotTarget = { twin_id: 'POND-071', camera_metric_1: '旧', camera_metrics_cleared: true }
applyTwinObservationUpdate(snapshotTarget, { twin_id: 'POND-071', observation_mode: 'snapshot', camera_result: '新' })
assert.equal(snapshotTarget.camera_metric_1, undefined, 'snapshot 模式必须移除上一快照字段与清除标记')
assert.equal(snapshotTarget.camera_result, '新')

assert.equal(twinObservationHasAlert({ twin_alert_level: 'warning', twin_alert_count: 0 }), true)
assert.equal(twinObservationHasAlert({ twin_alert_level: 'normal', twin_alert_count: 0 }), false)

const bridge = useFarmclawBridge()
bridge.handleMessage({
  type: 'twin_observation', twin_id: 'POND-080', source_node: 'camera-edge-01',
  alert: { level: 'warning', title: '塘口异常' }, camera: { status: 'online', result: '鱼群聚集' }
})
assert.equal(bridge.state.twinObservations['POND-080'].twin_alert_title, '塘口异常')
assert.equal(bridge.state.events[0].type, 'TWIN.ALERT', 'warning 无 count 也必须进入预警事件')
bridge.handleMessage({ type: 'camera_observation', twin_id: 'POND-080', camera: { result: '鱼群恢复' } })
assert.equal(bridge.state.twinObservations['POND-080'].twin_alert_title, '塘口异常', '连续 patch 不得丢失上一条预警')
assert.equal(bridge.state.twinObservations['POND-080'].camera_result, '鱼群恢复')
bridge.handleMessage({
  type: 'system_event', source: 'camera-edge-01',
  original_message: {
    type: 'camera_observation', twin_id: 'POND-080', observation_mode: 'snapshot',
    camera: { status: 'online', result: '快照替换结果' }
  }
})
assert.equal(bridge.state.twinObservations['POND-080'].twin_alert_title, undefined, 'system_event 包装的 snapshot 必须替换旧观测')
assert.equal(bridge.state.twinObservations['POND-080'].camera_result, '快照替换结果')
bridge.ingestTwinObservation({ twin_id: 'constructor', camera_result: '非法编号' })
assert.equal(Object.prototype.hasOwnProperty.call(bridge.state.twinObservations, 'constructor'), false)
for (let index = 0; index < 199; index += 1) {
  bridge.ingestTwinObservation({ twin_id: `FIELD-CACHE-${index}`, camera_result: '缓存边界测试' })
}
assert.equal(Object.keys(bridge.state.twinObservations).length, 200)
bridge.ingestTwinObservation({ twin_id: 'FIELD-CACHE-OVERFLOW', camera_result: '不得写入' })
assert.equal(Object.keys(bridge.state.twinObservations).length, 200, '对象观测缓存不得无限增长')
assert.equal(bridge.state.twinObservations['FIELD-CACHE-OVERFLOW'], undefined)

const mapSource = await readFile(new URL('../src/utils/freeMap.js', import.meta.url), 'utf8')
const modelSource = await readFile(new URL('../src/utils/twinObservation.js', import.meta.url), 'utf8')
const themeSource = await readFile(new URL('../src/style/theme.css', import.meta.url), 'utf8')
const bridgeSource = await readFile(new URL('../src/composables/useFarmclawBridge.js', import.meta.url), 'utf8')
const viewSource = await readFile(new URL('../src/views/index.vue', import.meta.url), 'utf8')
const packageSource = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

for (const marker of ['buildTwinObservation', 'appendTwinAlert', 'appendTwinCamera', '摄像头观测', '真实视频流未接入', 'farmclaw-twin-observation-popup', 'referrerPolicy', 'is-live', 'playing', 'setTwinObservationBatch', "maxWidth: isTwinObject ? '380px'"]) {
  assert.equal(mapSource.includes(marker), true, `空间对象弹窗缺少：${marker}`)
}
assert.equal(mapSource.includes("camera.feedMode === 'live' ? 'connecting' : camera.feedMode"), true, '视频真正 playing 前必须保持连接中样式')
for (const marker of ['媒体地址不在可信来源范围内', '当前显示${observation.camera.feedLabel}', '当前为上游识别结果']) {
  assert.equal(mapSource.includes(marker), true, `媒体边界说明缺少：${marker}`)
}
for (const marker of ['camera_stream_url', 'camera_snapshot_url', 'demo-twin-observation', 'twinObservationPropertyPatch', 'normalizeTwinId', 'observation_transport_status']) {
  assert.equal(modelSource.includes(marker), true, `对象观测模型缺少：${marker}`)
}
for (const marker of ['.farmclaw-twin-alert', '.farmclaw-twin-camera', '.farmclaw-camera-stage', '.farmclaw-camera-result', '.farmclaw-camera-metrics', 'farmclaw-twin-focus']) {
  assert.equal(themeSource.includes(marker), true, `观测弹窗样式缺少：${marker}`)
}
assert.equal(packageSource.scripts['test:twin-observation'], 'node scripts/validate-twin-observation.mjs')
assert.equal(viewSource.includes('twinObservationRevision'), true, '页面必须订阅对象观测更新')
assert.equal(bridgeSource.includes("['twin_observation', 'camera_observation']"), true, '网关观察者必须接收对象/摄像头观测消息')
assert.equal(bridgeSource.includes('MAX_TWIN_OBSERVATIONS'), true, '网关缓存必须设置对象数量上限')

console.log('Twin observation PASS: trusted LIVE/snapshot/demo boundaries, alert/camera patch semantics and popup wiring verified')
