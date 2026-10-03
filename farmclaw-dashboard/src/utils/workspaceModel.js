import { equipmentIconKey, classifyFacility, FACILITY_TYPE_LABELS, facilityIconDataUri } from './facilityIcons.js'
import { tablerIconDataUri } from './tablerIcons.js'
import { geometryRepresentativePoint } from './mapGeometry.js'
import { twinObjectPresentation } from './mapTwinVisuals.js'
import { securityStatusLabel } from './mapLabels.js'

const SPATIAL_ICONS = { farm: 'seedling', pool: 'fish', water: 'droplets', green: 'seedling', building: 'building', greenhouse: 'building' }
const SOURCE_BY_PREFIX = { FIELD: 'farm', POND: 'pool', WATER: 'water', GREEN: 'green', BLDG: 'building', GH: 'greenhouse' }
const PRIORITY = { danger: 0, warning: 1, neutral: 2, normal: 3 }

export function workspaceObjectImage(item) {
  if (SPATIAL_ICONS[item.sourceId]) return tablerIconDataUri(SPATIAL_ICONS[item.sourceId], { size: 48, stroke: ['pool', 'water'].includes(item.sourceId) ? '#3b98b1' : '#599d77', strokeWidth: 1.6 })
  if (item.type === '电子围栏') return tablerIconDataUri('shield-check', { size: 48, stroke: '#599d77' })
  return facilityIconDataUri(item.icon)
}

export function workspaceObjectKey(sourceId, id) {
  return `${sourceId === 'alert-risk' ? 'alert' : sourceId}:${id}`
}

export function mapObjectRecord(feature, sourceId = feature?.source) {
  const p = feature?.properties || {}
  sourceId ||= p.kind === 'machinery' ? 'machinery' : ['camera', 'fence'].includes(p.kind) ? 'security'
    : p.alert_id ? 'alert-risk' : SOURCE_BY_PREFIX[String(p.twin_id).split('-')[0]] || 'server'
  const id = String(p.alert_id || (p.kind ? p.id : p.twin_id) || p.id || feature?.id || p.name || '')
  const twin = twinObjectPresentation(p)
  const machinery = sourceId === 'machinery'
  const security = sourceId === 'security'
  const alert = sourceId === 'alert-risk'
  const spatial = Boolean(SPATIAL_ICONS[sourceId])
  const status = machinery ? p.status_label || p.statusLabel : security ? securityStatusLabel(p.status)
    : alert ? p.severity === 'warning' ? '高风险' : '需关注' : spatial ? twin.status : '空间档案'
  return {
    key: workspaceObjectKey(sourceId, id), id, sourceId,
    name: spatial ? twin.title : p.name || p.title || id,
    type: machinery ? p.type_label || p.typeLabel : security ? p.kind === 'camera' ? '摄像头' : '电子围栏'
      : alert ? p.risk_type === 'pest' ? '虫害预警' : '气候预警' : spatial ? twin.type : FACILITY_TYPE_LABELS[classifyFacility(p)],
    category: machinery ? 'machinery' : security ? 'security' : alert ? 'alert' : ['farm', 'pool', 'green', 'water', 'greenhouse'].includes(sourceId) ? 'field' : 'facility',
    icon: machinery ? p.machinery_type || p.type : security ? p.kind === 'camera' ? 'camera' : 'generic'
      : alert ? 'sensor' : SPATIAL_ICONS[sourceId] || classifyFacility(p),
    topic: machinery || sourceId === 'server' ? 'operations' : security ? 'security' : alert ? 'alerts' : 'product',
    status: status || '待补充',
    tone: p.status === 'alarm' || p.severity === 'warning' ? 'danger'
      : ['warning', 'offline', 'maintenance'].includes(p.machinery_status || p.status) || p.severity === 'attention' ? 'warning' : 'neutral',
    zone: p.zone || p.scope || p.department || twin.link,
    sourceLabel: p.twin_source || (security ? '本地安防演示' : alert ? '演示预警' : '演示空间底图'),
    aliases: [p.twin_id, p.twinId, p.crop, p.category, p.department].filter(Boolean).join(' '),
    coordinates: feature?.geometry ? geometryRepresentativePoint(feature.geometry, null) : null,
    fieldId: p.field_id || null,
    canAcknowledge: security && (p.status === 'alarm' || Number(p.incidents) > 0),
    facts: []
  }
}

export function equipmentObjectRecord(item) {
  return {
    key: workspaceObjectKey('equipment', item.id), id: item.id, sourceId: 'equipment',
    name: item.name, type: item.category, category: 'facility', icon: equipmentIconKey(item.category, item.name),
    topic: 'operations', status: item.statusLabel, tone: ['warning', 'offline'].includes(item.status) ? 'warning' : 'neutral',
    zone: item.zone, sourceLabel: '设施演示基线', coordinates: null, aliases: '',
    facts: [['编号', item.id], ['所属区域', item.zone], ['运行状态', item.statusLabel], ['负载', `${item.load}%`],
      ['运行工时', `${item.runtime} h`], ['基线信号时间', item.lastSignal], ['地图绑定', '未绑定位置']],
    note: '演示设施状态，尚未绑定空间坐标，不代表现场设备的当前状态。'
  }
}

export function alertObjectRecord(alert, mapRecord) {
  return {
    ...mapRecord, key: workspaceObjectKey('alert', alert.id), id: alert.id, sourceId: 'alert-risk',
    name: alert.title, type: alert.typeLabel, category: 'alert', icon: 'sensor', topic: 'alerts',
    status: alert.severityLabel, tone: alert.severity === 'warning' ? 'danger' : 'warning',
    zone: alert.scope, aliases: '', sourceLabel: '演示预警', coordinates: mapRecord?.coordinates || null,
    facts: [['影响范围', alert.scope], ['风险等级', alert.severityLabel], ['证据', alert.evidence],
      ['置信度', alert.confidence == null ? '待采集' : `${alert.confidence}%`], ['建议', alert.recommendation], ['时间范围', alert.window]],
    note: '演示预警，尚未接入实时气象或病虫害识别服务。'
  }
}

export function searchWorkspaceObjects(objects, query = '', category = 'all') {
  const normalize = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase()
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean)
  return objects.filter((item) => {
    if (category !== 'all' && item.category !== category) return false
    const haystack = normalize([item.id, item.name, item.type, item.zone, item.aliases].join(' '))
    return terms.every((term) => haystack.includes(term))
  }).sort((a, b) => {
    const exactA = normalize(a.id) === normalize(query) || normalize(a.name) === normalize(query)
    const exactB = normalize(b.id) === normalize(query) || normalize(b.name) === normalize(query)
    return Number(exactB) - Number(exactA) || (PRIORITY[a.tone] ?? 2) - (PRIORITY[b.tone] ?? 2)
      || a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
  })
}

export function buildAttentionQueue({ alertCenter, securityState, operations, aiState } = {}) {
  const queue = []
  for (const alert of alertCenter?.alerts || []) {
    if (!['warning', 'attention'].includes(alert.severity)) continue
    queue.push({ key: `alert:${alert.id}`, objectKey: `alert:${alert.id}`, category: 'risk',
      title: alert.title, detail: alert.evidence, scope: alert.scope, tone: alert.severity === 'warning' ? 'danger' : 'warning',
      status: '待复核', source: '演示预警', action: 'object' })
  }
  for (const item of [...(securityState?.cameras || []), ...(securityState?.fences || [])]) {
    if (!(item.status === 'alarm' || Number(item.incidents) > 0)) continue
    queue.push({ key: `security:${item.id}`, objectKey: `security:${item.id}`, category: 'security',
      title: `${item.name} · 告警复核`, detail: item.note || item.rule || '安防告警等待人工确认', scope: item.zone,
      tone: 'danger', status: '待确认', source: '本地安防演示', action: 'object' })
  }
  for (const [sourceId, items] of [['machinery', operations?.machinery?.items || []], ['equipment', operations?.equipment?.items || []]]) {
    for (const item of items) {
      if (!['warning', 'offline'].includes(item.status)) continue
      queue.push({ key: `${sourceId}:${item.id}`, objectKey: `${sourceId}:${item.id}`, category: 'equipment',
        title: `${item.name} · ${item.statusLabel}`, detail: item.alert || (item.status === 'offline' ? '信号中断，需检查设备与连接' : '设备状态异常，需现场复核'),
        scope: item.zone, tone: 'warning', status: '待检查', source: '设备演示基线', action: 'object' })
    }
  }
  for (const task of aiState?.tasks || []) {
    if (task.status !== 'awaiting_approval') continue
    queue.push({ key: `approval:${task.id}`, taskId: task.id, objectKey: task.targetId ? `security:${task.targetId}` : null,
      category: 'approval', title: task.title, detail: task.reason, scope: task.fieldId === 'farm' ? '全场' : task.fieldId,
      tone: task.risk === 'high' ? 'danger' : 'warning', status: '待审批',
      source: aiState.dryRun ? 'Dry Run 审批' : '网关审批', action: 'approval' })
  }
  return queue.sort((a, b) => PRIORITY[a.tone] - PRIORITY[b.tone] || a.key.localeCompare(b.key))
}
