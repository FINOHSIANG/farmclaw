import assert from 'node:assert/strict'
import {
  buildOperationsDashboard,
  EQUIPMENT_STATUS_LABELS,
  filterOperationsEquipment,
  RESOURCE_UNITS
} from '../src/utils/operationsDashboard.js'

const connection = { mode: 'gateway', connected: true, gatewayId: 'gw-demo' }
const nodes = [{ id: 'node-01', state: 'observed' }, { id: 'node-02', state: 'observed' }]
const lastUpdatedAt = '2026-08-25T14:35:00+08:00'
const model = buildOperationsDashboard({ connection, nodes, lastUpdatedAt, securityState: { level: 'normal' } })
const closeTo = (actual, expected) => Math.abs(actual - expected) < 1e-6

assert.deepEqual(Object.keys(model.resources), ['day', 'week', 'month'])
for (const key of ['day', 'week', 'month']) {
  const period = model.resources[key]
  assert.equal(period.source, 'demo-baseline')
  assert.deepEqual(period.units, RESOURCE_UNITS)
  assert.ok(period.series.length > 0)
  assert.ok(period.zoneBreakdown.length > 0)
  for (const resource of ['water', 'electricity', 'fertilizer', 'pesticide']) {
    assert.ok(period.summary[resource].target > 0)
    assert.ok(period.summary[resource].current > 0)
    assert.equal(period.summary[resource].delta, period.summary[resource].current - period.summary[resource].target)
    assert.ok(closeTo(period.series.reduce((sum, point) => sum + point[resource], 0), period.summary[resource].current))
    assert.ok(closeTo(period.zoneBreakdown.reduce((sum, zone) => sum + zone[resource].current, 0), period.summary[resource].current))
    assert.ok(closeTo(period.zoneBreakdown.reduce((sum, zone) => sum + zone[resource].target, 0), period.summary[resource].target))
  }
}

const equipment = model.equipment
assert.ok(equipment.items.length >= 6)
assert.equal(new Set(equipment.items.map((item) => item.id)).size, equipment.items.length)
assert.deepEqual(Object.keys(EQUIPMENT_STATUS_LABELS), ['running', 'standby', 'warning', 'offline'])
assert.deepEqual(equipment.counts, { running: 4, standby: 2, warning: 1, offline: 1 })
assert.equal(Object.values(equipment.counts).reduce((sum, count) => sum + count, 0), equipment.items.length)
for (const item of equipment.items) {
  assert.ok(EQUIPMENT_STATUS_LABELS[item.status])
  assert.equal(item.source, 'demo-baseline')
  assert.ok(!Number.isNaN(Date.parse(item.lastSignal)))
}

assert.equal(model.machinery.total, 7)
assert.equal(model.machinery.items.some((item) => equipment.items.some((device) => device.id === item.id)), false, '农机不得混入固定设施目录')
assert.equal(equipment.total, 8, '新增农机监测后固定设施统计口径必须保持不变')

assert.deepEqual(model.liveLink.connection, connection)
assert.deepEqual(model.liveLink.nodes, nodes)
assert.equal(model.liveLink.lastUpdatedAt, lastUpdatedAt)
assert.equal(model.liveLink.source, 'gateway-observation')
assert.deepEqual(filterOperationsEquipment(equipment, { status: 'running' }), equipment.items.filter((item) => item.status === 'running'))
assert.equal(filterOperationsEquipment(equipment, { query: '东区' }).length, 3)
assert.equal(model.resources.day.summary.pesticide.current, 29)

console.log(`operations dashboard validation passed: ${equipment.items.length} equipment, ${Object.values(equipment.counts).join('/')} status counts`)
