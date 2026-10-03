/**
 * 资源消耗与设施运转看板的数据模型。
 *
 * 该模块只负责把可预测的演示基线和网关观测输入整理成稳定的数据结构，
 * 不读取浏览器状态、不生成当前时间，也不把演示数据标记成在线数据。
 */

import { buildMachineryMonitor } from './machineryMonitor.js'

export const RESOURCE_UNITS = Object.freeze({
  water: 'm³',
  electricity: 'kWh',
  fertilizer: 'L',
  pesticide: 'L'
})

export const RESOURCE_LABELS = Object.freeze({
  water: '水',
  electricity: '电',
  fertilizer: '肥液',
  pesticide: '农药'
})

export const EQUIPMENT_STATUS_LABELS = Object.freeze({
  running: '运行中',
  standby: '待机',
  warning: '预警',
  offline: '离线'
})

// 常量基线用于演示和离线预览，所有结果均可重复计算。
const BASE_DAY = Object.freeze({
  water: { target: 420, current: 398 },
  electricity: { target: 260, current: 272 },
  fertilizer: { target: 180, current: 174 },
  pesticide: { target: 36, current: 29 }
})

const PERIODS = Object.freeze({
  day: { label: '今日', count: 24, unit: 'hour', multiplier: 1 },
  week: { label: '本周', count: 7, unit: 'cycle', multiplier: 7 },
  month: { label: '本月', count: 30, unit: 'cycle', multiplier: 30 }
})

const SERIES_PROFILE = Object.freeze([
  0.025, 0.022, 0.02, 0.018, 0.02, 0.028, 0.045, 0.06,
  0.075, 0.07, 0.058, 0.05, 0.045, 0.045, 0.05, 0.058,
  0.07, 0.075, 0.065, 0.05, 0.04, 0.032, 0.028, 0.024
])

const ZONES = Object.freeze([
  { id: 'zone-east', name: '东区温室', share: 0.31 },
  { id: 'zone-west', name: '西区温室', share: 0.27 },
  { id: 'zone-north', name: '北侧露地', share: 0.24 },
  { id: 'zone-south', name: '南侧水产', share: 0.18 }
])

const EQUIPMENT_BASELINE = Object.freeze([
  { id: 'pump-east-01', name: '东区灌溉泵 01', category: '灌溉泵', zone: '东区温室', status: 'running', load: 76, runtime: 18.4, lastSignal: '2026-08-25T14:32:00+08:00' },
  { id: 'pump-west-01', name: '西区灌溉泵 01', category: '灌溉泵', zone: '西区温室', status: 'standby', load: 12, runtime: 9.1, lastSignal: '2026-08-25T14:28:00+08:00' },
  { id: 'fan-east-02', name: '东区环流风机 02', category: '环境控制', zone: '东区温室', status: 'running', load: 64, runtime: 21.7, lastSignal: '2026-08-25T14:31:00+08:00' },
  { id: 'doser-north-01', name: '北区肥液机 01', category: '施肥机', zone: '北侧露地', status: 'warning', load: 88, runtime: 16.2, lastSignal: '2026-08-25T14:21:00+08:00' },
  { id: 'aerator-south-03', name: '南区增氧机 03', category: '水产设备', zone: '南侧水产', status: 'running', load: 58, runtime: 22.5, lastSignal: '2026-08-25T14:30:00+08:00' },
  { id: 'sensor-west-07', name: '西区环境传感器 07', category: '传感器', zone: '西区温室', status: 'offline', load: 0, runtime: 0, lastSignal: '2026-08-25T12:06:00+08:00' },
  { id: 'valve-south-02', name: '南区进水阀 02', category: '阀门', zone: '南侧水产', status: 'standby', load: 8, runtime: 6.8, lastSignal: '2026-08-25T14:27:00+08:00' },
  { id: 'light-east-04', name: '东区补光灯 04', category: '环境控制', zone: '东区温室', status: 'running', load: 71, runtime: 13.9, lastSignal: '2026-08-25T14:29:00+08:00' }
])

function round(value, digits = 1) {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function metric(target, current) {
  return { target, current, delta: round(current - target) }
}

function periodLabels(period) {
  if (period.unit === 'hour') return Array.from({ length: period.count }, (_, index) => `${String(index).padStart(2, '0')}:00`)
  return Array.from({ length: period.count }, (_, index) => `周期 ${String(index + 1).padStart(2, '0')}`)
}

function allocate(total, count, profile = SERIES_PROFILE) {
  const weights = Array.from({ length: count }, (_, index) => profile[index % profile.length])
  const weightTotal = weights.reduce((sum, value) => sum + value, 0)
  const values = weights.map((value) => round((total * value) / weightTotal))
  const correction = round(total - values.reduce((sum, value) => sum + value, 0))
  values[values.length - 1] = round(values[values.length - 1] + correction)
  return values
}

function buildZoneBreakdown(summary) {
  const zones = ZONES.map((zone) => ({
    id: zone.id,
    name: zone.name,
    source: 'demo-baseline',
    water: metric(round(summary.water.target * zone.share), round(summary.water.current * zone.share)),
    electricity: metric(round(summary.electricity.target * zone.share), round(summary.electricity.current * zone.share)),
    fertilizer: metric(round(summary.fertilizer.target * zone.share), round(summary.fertilizer.current * zone.share)),
    pesticide: metric(round(summary.pesticide.target * zone.share), round(summary.pesticide.current * zone.share))
  }))
  for (const resource of Object.keys(BASE_DAY)) {
    const last = zones.at(-1)
    last[resource].target = round(last[resource].target + summary[resource].target - zones.reduce((sum, zone) => sum + zone[resource].target, 0))
    last[resource].current = round(last[resource].current + summary[resource].current - zones.reduce((sum, zone) => sum + zone[resource].current, 0))
    last[resource].delta = round(last[resource].current - last[resource].target)
  }
  return zones
}

function buildResourcePeriod(key) {
  const period = PERIODS[key]
  const summary = Object.fromEntries(Object.entries(BASE_DAY).map(([resource, values]) => [
    resource,
    metric(round(values.target * period.multiplier), round(values.current * period.multiplier))
  ]))
  const labels = periodLabels(period)
  const seriesValues = Object.fromEntries(Object.keys(BASE_DAY).map((resource) => [
    resource,
    allocate(summary[resource].current, period.count)
  ]))
  const series = labels.map((label, index) => ({
    label,
    index,
    water: seriesValues.water[index],
    electricity: seriesValues.electricity[index],
    fertilizer: seriesValues.fertilizer[index],
    pesticide: seriesValues.pesticide[index],
    source: 'demo-baseline'
  }))
  const zoneBreakdown = buildZoneBreakdown(summary)
  return {
    key,
    label: period.label,
    granularity: period.unit,
    source: 'demo-baseline',
    units: { ...RESOURCE_UNITS },
    summary,
    series,
    sequence: series,
    zoneBreakdown,
    zones: zoneBreakdown
  }
}

function buildEquipment() {
  const items = EQUIPMENT_BASELINE.map((item) => ({ ...item, statusLabel: EQUIPMENT_STATUS_LABELS[item.status], source: 'demo-baseline' }))
  const counts = Object.fromEntries(Object.keys(EQUIPMENT_STATUS_LABELS).map((status) => [
    status,
    items.filter((item) => item.status === status).length
  ]))
  return { source: 'demo-baseline', items, devices: items, total: items.length, counts }
}

/** Build the complete operations dashboard model without side effects. */
export function buildOperationsDashboard({ connection = null, nodes = null, lastUpdatedAt = null, securityState = null } = {}) {
  return {
    resources: { day: buildResourcePeriod('day'), week: buildResourcePeriod('week'), month: buildResourcePeriod('month') },
    equipment: buildEquipment(),
    machinery: buildMachineryMonitor(),
    // 仅透传网关输入；演示资源和设备不会影响 liveLink 的真实性。
    liveLink: { connection, nodes, lastUpdatedAt, source: 'gateway-observation' },
    securityState
  }
}

export function filterOperationsEquipment(equipment, { status = 'all', category = 'all', zone = 'all', query = '' } = {}) {
  const items = Array.isArray(equipment) ? equipment : (equipment?.items || equipment?.devices || [])
  const needle = String(query).trim().toLowerCase()
  return items.filter((item) => {
    if (status !== 'all' && item.status !== status) return false
    if (category !== 'all' && item.category !== category) return false
    if (zone !== 'all' && item.zone !== zone) return false
    if (needle && ![item.id, item.name, item.category, item.zone].some((value) => String(value).toLowerCase().includes(needle))) return false
    return true
  })
}

export const filterEquipment = filterOperationsEquipment
export const STATUS_LABELS = EQUIPMENT_STATUS_LABELS
