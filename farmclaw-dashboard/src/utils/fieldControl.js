const FIELD_CROPS = Object.freeze([
  { crop: '有机水稻', stage: '分蘖期', progress: 46 },
  { crop: '鲜食玉米', stage: '拔节期', progress: 58 },
  { crop: '有机番薯', stage: '块根膨大期', progress: 71 },
  { crop: '叶菜轮作', stage: '营养生长期', progress: 39 }
])

function fieldOrdinal(field = {}) {
  const match = String(field.id || field.key || '').match(/(\d+)(?!.*\d)/)
  return Number(match?.[1]) || 1
}

function numericReading(readings, key) {
  const value = Number(readings?.[key]?.value)
  return Number.isFinite(value) ? value : null
}

function readingMetric(readings, key, fallbackLabel, unit, range) {
  const reading = readings?.[key]
  const value = numericReading(readings, key)
  const status = value == null ? 'pending' : value >= range[0] && value <= range[1] ? 'normal' : 'attention'
  return {
    key,
    label: reading?.label || fallbackLabel,
    value: value == null ? '--' : value,
    unit: reading?.unit || unit,
    status
  }
}

function machineryEnergy(item = {}) {
  const value = item.energy ?? item.battery ?? item.batteryPercent ?? item.fuel ?? item.fuelPercent
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return { energyValue: null, energyLabel: '状态待采集' }
  const isBattery = item.energyKind === 'battery' || item.battery != null || item.batteryPercent != null
  return { energyValue: numericValue, energyLabel: `${isBattery ? '电量' : '油量'} ${numericValue}%` }
}

export function buildFieldControlModel(field = {}, { readings = {}, machinery = [] } = {}) {
  const ordinal = fieldOrdinal(field)
  const profile = FIELD_CROPS[(ordinal - 1) % FIELD_CROPS.length]
  const availableMachinery = machinery
    .filter((item) => ['running', 'standby', 'charging'].includes(item.status))
    .map((item) => ({ ...item, ...machineryEnergy(item) }))
  const moisture = numericReading(readings, 'soil_moisture')
  const active = field.status !== '待利用'
  const fieldTwin = field.fieldTwin || {
    rowCount: 8 + ordinal % 4,
    sensorCount: 4,
    valveCount: 2,
    zoneCount: 3,
    onlineCount: 3
  }
  const metrics = [
    readingMetric(readings, 'soil_moisture', '土壤水分', '%', [30, 70]),
    readingMetric(readings, 'temperature', '环境温度', '℃', [16, 30]),
    readingMetric(readings, 'humidity', '空气湿度', '%', [40, 85]),
    readingMetric(readings, 'light', '光照强度', 'lux', [3000, 50000])
  ]

  return {
    id: field.id,
    name: field.name,
    status: field.status,
    tone: field.tone,
    crop: active ? profile.crop : '待安排作物',
    stage: active ? profile.stage : '休耕整备',
    progress: active ? profile.progress : 0,
    area: `${(0.68 + (ordinal % 9) * 0.14).toFixed(2)} ha`,
    zones: 6 + (ordinal % 7),
    sourceLabel: field.sourceLabel,
    metrics,
    healthyMetrics: metrics.filter((item) => item.status === 'normal').length,
    availableMachinery: availableMachinery.slice(0, 3),
    fieldTwin,
    controls: [
      {
        id: 'irrigation', icon: 'droplets', label: '分区灌溉',
        detail: moisture == null ? '土壤水分待采集' : `土壤水分 ${moisture}%`,
        state: 'standby', stateLabel: moisture != null && moisture < 40 ? '建议补水' : '自动待命',
        available: active, actionLabel: '模拟启动'
      },
      {
        id: 'patrol', icon: 'drone', label: '地块巡检',
        detail: `${availableMachinery.length} 台设备可调度`, state: 'standby', stateLabel: '航线待命',
        available: availableMachinery.length > 0, actionLabel: '模拟巡检'
      },
      {
        id: 'protection', icon: 'spray', label: '植保作业',
        detail: '处方与风速需人工复核', state: 'guarded', stateLabel: '审批保护',
        available: active, actionLabel: '加入队列'
      },
      {
        id: 'sampling', icon: 'test-pipe', label: '土壤采样',
        detail: `${metrics.filter((item) => item.value !== '--').length}/4 项环境数据`, state: 'standby', stateLabel: '计划待命',
        available: true, actionLabel: '创建任务'
      }
    ]
  }
}

export function applyFieldControlAction(controls = [], controlId) {
  let outcome = null
  const next = controls.map((control) => {
    if (control.id !== controlId || !control.available) return control
    const running = control.state === 'running'
    outcome = { id: control.id, label: control.label, active: !running }
    return {
      ...control,
      state: running ? (control.id === 'protection' ? 'guarded' : 'standby') : 'running',
      stateLabel: running ? (control.id === 'protection' ? '审批保护' : '已停止') : control.id === 'protection' ? '已加入队列' : '本地模拟运行',
      actionLabel: running ? '再次模拟' : '模拟停止'
    }
  })
  return { controls: next, outcome }
}
