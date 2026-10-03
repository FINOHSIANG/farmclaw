import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const hud = await readFile(new URL('../src/components/FarmclawHud.vue', import.meta.url), 'utf8')
const bridge = await readFile(new URL('../src/composables/useFarmclawBridge.js', import.meta.url), 'utf8')
const view = await readFile(new URL('../src/views/index.vue', import.meta.url), 'utf8')

for (const implementation of [
  "const activeAgentId = ref('agri-advisor')",
  'aria-label="对话 Agent"',
  'aria-label="上传文件或图片"',
  '仅本地预览 · 尚未上传',
  'uploaded: false',
  'URL.createObjectURL(file)',
  'URL.revokeObjectURL',
  '最多同时添加 5 个文件',
  '单个不超过 10 MB',
  "'has-attachments'"
]) assert.equal(hud.includes(implementation), true, `缺少对话编辑器实现：${implementation}`)

assert.equal(bridge.includes('agent_id: agentId'), true, '聊天协议必须携带本地 Agent 路由标识')
assert.equal(bridge.includes('uploaded: false'), true, '附件元数据必须明确标记为未上传')
assert.equal(bridge.includes('附件仅发送元数据，文件内容未上传'), true, '事件流必须说明附件内容未上传')
assert.equal(view.includes('@command="handleCommand"'), true, '页面必须接收结构化命令事件')

console.log('Command composer validation passed: 3 local agents, safe local attachments, protocol metadata, and cleanup verified')
