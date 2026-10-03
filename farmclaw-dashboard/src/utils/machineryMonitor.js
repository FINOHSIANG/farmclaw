/**
 * 农机监测的稳定演示模型。
 *
 * 这里把“机器是谁、正在做什么、当前是否可用、最近是否上报”放在同一份
 * 可复用数据里，运营面板和数字孪生地图共用这份口径。数据明确标记为演示
 * 遥测，不把静态基线伪装成现场控制结果。
 */

export const MACHINERY_STATUS_LABELS = Object.freeze({
  running: '作业中',
  standby: '待机',
  charging: '充电中',
  warning: '异常',
  offline: '离线'
})

export const MACHINERY_FRESHNESS_LABELS = Object.freeze({
  live: '实时',
  stale: '已过期',
  simulated: '演示',
  unknown: '未知'
})

export const MACHINERY_TYPE_LABELS = Object.freeze({
  tractor: '履带式拖拉机',
  harvester: '联合收割机',
  sprayer: '自走式植保机',
  seeder: '精量播种机',
  rover: '田间巡检车',
  mower: '智能除草机',
  transporter: '农用运输车'
})

const MACHINERY_BASELINE = Object.freeze([
  {
    id: 'tractor-east-01', twinId: 'MACH-001', name: '东区履带拖拉机', type: 'tractor', zone: '东区温室',
    task: '整地 · 东侧 3 号地块', status: 'running', progress: 68, speed: 4.8, energyKind: 'fuel', fuel: 72,
    engineHours: 1284.6, workArea: 2.8, runtimeToday: 5.6, mode: '自动作业', operator: '周师傅',
    lastSignal: '2026-09-02T14:32:00+08:00', nextService: '剩余 46 h', alert: '', heading: 82,
    coordinates: [113.5355, 22.7378]
  },
  {
    id: 'harvester-north-01', twinId: 'MACH-002', name: '北区联合收割机', type: 'harvester', zone: '北侧露地',
    task: '采收 · 早稻示范田', status: 'running', progress: 42, speed: 3.2, energyKind: 'fuel', fuel: 54,
    engineHours: 936.2, workArea: 4.1, runtimeToday: 3.8, mode: '人工接管', operator: '李师傅',
    lastSignal: '2026-09-02T14:29:00+08:00', nextService: '剩余 18 h', alert: '', heading: 146,
    coordinates: [113.5274, 22.7424]
  },
  {
    id: 'sprayer-west-02', twinId: 'MACH-003', name: '西区自走植保机', type: 'sprayer', zone: '西区温室',
    task: '叶面喷施 · 7 号棚', status: 'warning', progress: 31, speed: 1.6, energyKind: 'fuel', fuel: 28,
    engineHours: 604.8, workArea: 1.3, runtimeToday: 2.2, mode: '限速运行', operator: '待分派',
    lastSignal: '2026-09-02T14:18:00+08:00', nextService: '需检修', alert: '喷头压力偏低 · 建议人工复核', heading: 258,
    coordinates: [113.5242, 22.7369]
  },
  {
    id: 'seeder-south-01', twinId: 'MACH-004', name: '南区精量播种机', type: 'seeder', zone: '南侧水产',
    task: '待命 · 秋茬播种计划', status: 'standby', progress: 0, speed: 0, energyKind: 'fuel', fuel: 86,
    engineHours: 412.4, workArea: 0, runtimeToday: 0.4, mode: '待命锁定', operator: '未分派',
    lastSignal: '2026-09-02T14:27:00+08:00', nextService: '剩余 72 h', alert: '', heading: 18,
    coordinates: [113.5381, 22.7304]
  },
  {
    id: 'rover-greenhouse-03', twinId: 'MACH-005', name: '温室巡检车 03', type: 'rover', zone: '核心温室区',
    task: '充电 · 计划巡检 12 号棚', status: 'charging', progress: 15, speed: 0, energyKind: 'battery', battery: 64,
    engineHours: 188.3, workArea: 0.6, runtimeToday: 1.9, mode: '自动回桩', operator: '系统调度',
    lastSignal: '2026-09-02T14:34:00+08:00', nextService: '剩余 126 h', alert: '', heading: 304,
    coordinates: [113.5322, 22.7336]
  },
  {
    id: 'mower-orchard-01', twinId: 'MACH-006', name: '果园智能除草机', type: 'mower', zone: 'B区果园',
    task: '失联 · 果园北坡', status: 'offline', progress: 57, speed: 0, energyKind: 'battery', battery: 19,
    engineHours: 276.1, workArea: 0.9, runtimeToday: 2.7, mode: '信号丢失', operator: '王师傅',
    lastSignal: '2026-09-02T13:46:00+08:00', nextService: '待诊断', alert: '超过 45 分钟未上报位置', heading: 221,
    coordinates: [113.5427, 22.7411]
  },
  {
    id: 'transporter-south-02', twinId: 'MACH-007', name: '南区农用运输车', type: 'transporter', zone: '南侧水产',
    task: '转运 · 饲料仓 → 养殖区', status: 'running', progress: 79, speed: 12.4, energyKind: 'fuel', fuel: 61,
    engineHours: 742.9, workArea: 1.8, runtimeToday: 4.4, mode: '路线跟随', operator: '陈师傅',
    lastSignal: '2026-09-02T14:31:00+08:00', nextService: '剩余 33 h', alert: '', heading: 112,
    coordinates: [113.5369, 22.7331]
  }
])

function validCoordinates(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return false
  const longitude = Number(coordinates[0])
  const latitude = Number(coordinates[1])
  return Number.isFinite(longitude) && Number.isFinite(latitude) && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90
}

function resolveFreshness(item, referenceTime) {
  if (['live', 'stale', 'simulated', 'unknown'].includes(item.freshness)) return item.freshness
  if (item.source === 'gateway-observation') {
    const observedAt = Date.parse(item.observedAt || item.lastSignal || '')
    const reference = Date.parse(referenceTime || '')
    if (Number.isFinite(observedAt) && Number.isFinite(reference)) return reference - observedAt > 15 * 60_000 ? 'stale' : 'live'
    return 'unknown'
  }
  return 'simulated'
}

function clone(item, referenceTime) {
  const freshness = resolveFreshness(item, referenceTime)
  const coordinates = validCoordinates(item.coordinates) ? [Number(item.coordinates[0]), Number(item.coordinates[1])] : null
  const type = item.type || item.category || 'rover'
  const status = MACHINERY_STATUS_LABELS[item.status] ? item.status : 'offline'
  return {
    ...item,
    type,
    category: type,
    typeLabel: MACHINERY_TYPE_LABELS[type] || '农机设备',
    status,
    statusLabel: MACHINERY_STATUS_LABELS[status] || '未知',
    freshness,
    freshnessLabel: MACHINERY_FRESHNESS_LABELS[freshness] || '未知',
    coordinates,
    source: item.source || 'demo-machinery',
    twin_id: item.twinId,
    twin_type: '农机设备',
    twin_status: `${MACHINERY_STATUS_LABELS[status] || '状态待补充'} · ${MACHINERY_FRESHNESS_LABELS[freshness] || '未知'}`,
    twin_source: item.source === 'gateway-observation' ? '网关农机遥测' : '演示农机遥测',
    twin_link: '未关联真实作业单',
    kind: 'machinery',
    taskName: item.task,
    fieldId: item.fieldId || item.zone,
    speedKph: Number(item.speed) || 0,
    fuelPercent: item.fuel ?? null,
    batteryPercent: item.battery ?? null,
    headingDeg: Number(item.heading) || 0,
    observedAt: item.observedAt || item.lastSignal || null
  }
}

function averageEnergy(items) {
  if (!items.length) return 0
  const levels = items.map((item) => item.energyKind === 'battery' ? Number(item.battery) : Number(item.fuel))
  return Math.round(levels.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) / levels.length)
}

/** 构建农机监测看板模型；不读取时间和浏览器状态，结果可重复。 */
export function buildMachineryMonitor({ observations = [], referenceTime = '2026-09-02T14:35:00+08:00' } = {}) {
  const observationById = new Map((Array.isArray(observations) ? observations : []).filter((item) => item?.id).map((item) => [item.id, item]))
  const items = MACHINERY_BASELINE.map((baseline) => clone({ ...baseline, ...(observationById.get(baseline.id) || {}) }, referenceTime))
  const counts = Object.fromEntries(Object.keys(MACHINERY_STATUS_LABELS).map((status) => [
    status,
    items.filter((item) => item.status === status).length
  ]))
  return {
    source: 'demo-machinery',
    sourceLabel: '演示农机遥测',
    items,
    machines: items,
    total: items.length,
    locatedCount: items.filter((item) => validCoordinates(item.coordinates)).length,
    counts,
    freshnessCounts: Object.fromEntries(Object.keys(MACHINERY_FRESHNESS_LABELS).map((freshness) => [
      freshness,
      items.filter((item) => item.freshness === freshness).length
    ])),
    activeTasks: items.filter((item) => item.status === 'running').length,
    warningCount: items.filter((item) => ['warning', 'offline'].includes(item.status)).length,
    coverageArea: Math.round(items.reduce((sum, item) => sum + Number(item.workArea || 0), 0) * 10) / 10,
    runtimeToday: Math.round(items.reduce((sum, item) => sum + Number(item.runtimeToday || 0), 0) * 10) / 10,
    averageEnergy: averageEnergy(items),
    lastUpdatedAt: referenceTime
  }
}

export function filterMachinery(machinery, { status = 'all', type = 'all', zone = 'all', query = '' } = {}) {
  const items = Array.isArray(machinery) ? machinery : (machinery?.items || machinery?.machines || [])
  const needle = String(query).trim().toLowerCase()
  return items.filter((item) => {
    if (status !== 'all' && item.status !== status) return false
    if (type !== 'all' && item.type !== type) return false
    if (zone !== 'all' && item.zone !== zone) return false
    if (needle && ![item.id, item.twinId, item.name, item.typeLabel, item.zone, item.task].some((value) => String(value || '').toLowerCase().includes(needle))) return false
    return true
  })
}

/** 供 MapLibre 使用的点位数据，与看板共用同一份机器身份和状态。 */
export function buildMachineryGeoJson(machinery = buildMachineryMonitor()) {
  return {
    type: 'FeatureCollection',
    features: (machinery.items || []).filter((item) => validCoordinates(item.coordinates)).map((item) => ({
      type: 'Feature',
      id: item.id,
      properties: {
        ...clone(item),
        machine_id: item.id,
        machinery_type: item.type || item.category,
        machinery_status: item.status,
        coordinate_system: 'WGS84',
        type_label: MACHINERY_TYPE_LABELS[item.type] || '农机设备',
        status_label: MACHINERY_STATUS_LABELS[item.status] || '未知',
        freshness: item.freshness,
        freshness_label: item.freshnessLabel,
        task_progress: item.progress,
        speed_kph: item.speedKph,
        fuel_percent: item.fuel ?? null,
        battery_percent: item.battery ?? null,
        energy_label: item.energyKind === 'battery' ? `电量 ${item.battery}%` : `油量 ${item.fuel}%`,
        engine_hours: item.engineHours,
        runtime_today: item.runtimeToday,
        work_area: item.workArea,
        last_signal: item.lastSignal,
        next_service: item.nextService,
        operator: item.operator,
        machine_mode: item.mode,
        machine_task: item.task,
        alert_note: item.alert,
        heading: item.heading,
        heading_deg: item.headingDeg,
        observed_at: item.observedAt
      },
      geometry: { type: 'Point', coordinates: [...item.coordinates] }
    }))
  }
}

export function getMachineryById(machineId, machinery = buildMachineryMonitor()) {
  return machinery.items.find((item) => item.id === machineId || item.twinId === machineId) || null
}

export const MACHINERY_BASELINE_IDS = Object.freeze(MACHINERY_BASELINE.map((item) => item.id))
