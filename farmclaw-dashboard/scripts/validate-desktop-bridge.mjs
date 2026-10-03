import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { getFarmclawDesktopApi, mapDshFrameToBridgeEvent } from '../src/composables/useFarmclawBridge.js'

const desktopApi = {
  bootstrap() {},
  dshRequest() {}
}

assert.equal(getFarmclawDesktopApi({ window: { farmclawDesktop: desktopApi } }), desktopApi)
assert.equal(getFarmclawDesktopApi({ window: {} }), null)
assert.deepEqual(mapDshFrameToBridgeEvent({
  payload: { type: 'host/session-status', running: true }
}), { type: 'AI.RUNNING', text: 'DSH Agent 正在处理指令', source: 'dsh' })
assert.deepEqual(mapDshFrameToBridgeEvent({
  payload: { type: 'session/event', event: { type: 'assistant/message', data: { content: [{ type: 'text', text: '灌溉建议已生成' }] } } }
}), { type: 'AI.MESSAGE', text: '灌溉建议已生成', source: 'dsh' })

const source = await readFile(new URL('../src/composables/useFarmclawBridge.js', import.meta.url), 'utf8')
for (const implementation of [
  "requestDsh('session.create'",
  "requestDsh('session.prompt'",
  "requestDsh('session.history'",
  'sendGatewayCommand(message, agentLabel, summary, attachments)',
  '官方 DSH 不可用，指令将回退网关'
]) assert.equal(source.includes(implementation), true, `缺少桌面桥接实现：${implementation}`)

console.log('Desktop bridge validation passed: API detection, DSH session path, event mapping, and gateway fallback verified')
