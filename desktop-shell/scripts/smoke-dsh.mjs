import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = path.resolve(root, '..')
const dshBin = path.join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
const patchFile = path.join(root, 'profile', 'farmclaw.yml')
const dshHome = await mkdtemp(path.join(os.tmpdir(), 'farmclaw-dsh-smoke-'))
const pattern = /dsh\s+web:\s+(http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]{43})/iu

let child
try {
  child = spawn(process.execPath, [dshBin, 'web', '--patch', patchFile, '--host', '127.0.0.1', '--port', '0', '--no-open'], {
    cwd: projectRoot,
    env: { ...process.env, DSH_HOME: dshHome, DSH_CWD: projectRoot },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })

  const startupUrl = await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error('DSH smoke 启动超时')), 120_000)
    const inspect = (chunk) => {
      output += chunk
      const candidate = output.match(pattern)?.[1]
      if (!candidate) return
      clearTimeout(timer)
      resolve(candidate)
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', inspect)
    child.stderr.on('data', inspect)
    child.once('error', reject)
    child.once('exit', (code) => reject(new Error(`DSH smoke 在就绪前退出：${code}`)))
  })

  const auth = await fetch(startupUrl, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
  if (auth.status !== 303 || auth.headers.get('location') !== '/') throw new Error(`DSH smoke 认证失败：HTTP ${auth.status}`)
  const setCookies = typeof auth.headers.getSetCookie === 'function'
    ? auth.headers.getSetCookie()
    : [auth.headers.get('set-cookie') || '']
  const cookie = setCookies
    .map((item) => item.split(';', 1)[0]?.trim())
    .find((item) => /^dsh-auth-[^=]+=.+$/u.test(item || ''))
  if (!cookie) throw new Error('DSH smoke 未获得认证 Cookie')

  const origin = new URL(startupUrl).origin
  const call = async (endpoint, args) => {
    const rpcId = randomUUID()
    const response = await fetch(`${origin}/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ type: 'client-request', rpcId, method: endpoint, payload: { args } }),
      signal: AbortSignal.timeout(30_000)
    })
    const body = await response.json()
    if (!response.ok || body?.type !== 'server-response' || body?.rpcId !== rpcId || body?.result?.ok !== true) {
      throw new Error(`DSH smoke RPC ${endpoint} 失败：HTTP ${response.status}`)
    }
    return body.result.value
  }
  const created = await call('session/create', { request: { cwd: projectRoot } })
  if (typeof created?.sessionId !== 'string' || !created.sessionId) throw new Error('DSH smoke session/create 未返回会话编号')
  const prompted = await call('session/prompt', {
    request: {
      requestId: randomUUID(),
      sessionId: created.sessionId,
      mode: 'queue',
      content: [{ type: 'text', text: '只回复 CONNECTIVITY_OK' }],
      clientTimeZone: 'Asia/Shanghai'
    }
  })
  if (prompted?.accepted !== true) throw new Error('DSH smoke session/prompt 未接受指令')
  const cancelled = await call('session/cancel', { request: { sessionId: created.sessionId } })
  if (cancelled?.accepted !== true) throw new Error('DSH smoke session/cancel 未接受取消')
  const listed = await call('session/list', { _request: {} })
  const count = Array.isArray(listed?.items) ? listed.items.length : 0
  if (!listed.items?.some((item) => item?.sessionId === created.sessionId)) throw new Error('DSH smoke 新会话未出现在 session/list')
  console.log(`DSH smoke passed: authenticated runtime, session/create, session/prompt, session/cancel, and session/list (${count} sessions)`)
} finally {
  if (child?.pid && child.exitCode === null) {
    if (process.platform === 'win32') {
      await new Promise((resolve) => {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
        killer.once('error', resolve)
        killer.once('close', resolve)
      })
    } else child.kill('SIGTERM')
  }
  await rm(dshHome, { recursive: true, force: true })
}
