import { app, BrowserWindow, ipcMain, Menu, session } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { DshClient } from './dsh-client.js'
import { mapDshRequest, assertAllowedDshMethod } from './ipc-policy.js'
import { DshRuntime } from './runtime.js'
import { isAllowedNavigationUrl, isTrustedRendererUrl } from './security.js'
import { normalizeSessionSnapshot } from './session-follow.js'

type JsonRecord = Record<string, unknown>

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const shellRoot = path.resolve(moduleDir, '..')
const projectRoot = path.resolve(shellRoot, '..')
const dashboardEntry = path.resolve(projectRoot, 'farmclaw-dashboard', 'dist', 'index.html')
const rendererUrl = pathToFileURL(dashboardEntry).href
const preloadPath = path.resolve(shellRoot, 'dist', 'preload.cjs')
const dshBin = path.resolve(shellRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
const profilePatch = path.resolve(shellRoot, 'profile', 'farmclaw.yml')

let mainWindow: BrowserWindow | null = null
let runtime: DshRuntime | null = null
let client: DshClient | null = null
let eventController: AbortController | null = null
let quitting = false
const follows = new Map<string, AbortController>()
let bootstrapState = { dshReady: false, workspace: projectRoot, startupError: '' }

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function send(channel: string, payload?: unknown): void {
  if (!mainWindow?.isDestroyed()) mainWindow?.webContents.send(channel, payload)
}

function configureSecurity(): void {
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
}

function createWindow(): BrowserWindow {
  if (!fs.existsSync(dashboardEntry)) throw new Error(`前端构建产物不存在：${dashboardEntry}`)
  const window = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#071411',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigationUrl(url, rendererUrl)) event.preventDefault()
  })
  window.once('ready-to-show', () => window.show())
  void window.loadURL(`${rendererUrl}#/index`)
  return window
}

function assertTrustedSender(event: Electron.IpcMainInvokeEvent): void {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
    throw new Error('IPC 调用来源不是主窗口')
  }
  if (!isTrustedRendererUrl(event.senderFrame.url, rendererUrl)) throw new Error('IPC 调用来源不可信')
}

function handle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, async (event, ...args) => {
    assertTrustedSender(event)
    return listener(event, ...args)
  })
}

function sendSessionEvent(sessionId: string, event: unknown): void {
  send('farmclaw:dsh-frame', { rpcId: randomUUID(), payload: { type: 'session/event', sessionId, event } })
}

async function followSession(args: JsonRecord): Promise<{ events: Array<{ event: JsonRecord }>; hasMore: boolean }> {
  if (!client) throw new Error('官方 DSH 尚未启动')
  const request = asRecord(args.request)
  const address = asRecord(request.address)
  const sessionId = String(address.sessionId || '')
  follows.get(sessionId)?.abort()
  const controller = new AbortController()
  follows.set(sessionId, controller)
  let opened = false
  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        for await (const item of (client as DshClient).stream('session/follow', args, controller.signal)) {
          const frame = asRecord(item)
          if (frame.type === 'snapshot') {
            const normalized = normalizeSessionSnapshot(frame)
            if (!opened) {
              opened = true
              resolve(normalized.history)
            } else {
              for (const entry of normalized.history.events) sendSessionEvent(sessionId, entry.event)
            }
          } else if (frame.type === 'event') {
            sendSessionEvent(sessionId, frame.event)
          } else if (frame.type === 'assistant-stream') {
            send('farmclaw:dsh-frame', { rpcId: randomUUID(), payload: { type: 'session/assistant-stream', sessionId, frame: frame.frame } })
          }
        }
        if (!opened) reject(new Error('DSH session/follow 未返回快照'))
      } catch (error) {
        if (!controller.signal.aborted && !opened) reject(error)
      } finally {
        if (follows.get(sessionId) === controller) follows.delete(sessionId)
      }
    })()
  })
}

async function startEvents(activeClient: DshClient): Promise<void> {
  eventController?.abort()
  const controller = new AbortController()
  eventController = controller
  try {
    for await (const item of activeClient.stream('$events', {}, controller.signal)) {
      const frame = asRecord(item)
      if (frame.type !== 'emit') continue
      const args = Array.isArray(frame.args) ? frame.args : []
      if (frame.event === 'api-session/status') {
        send('farmclaw:dsh-frame', { rpcId: randomUUID(), payload: { type: 'host/session-status', sessionId: String(args[0] || ''), running: args[1] === true } })
      } else if (frame.event === 'api-session/error') {
        send('farmclaw:dsh-frame', { rpcId: randomUUID(), payload: { type: 'host/agent-error', sessionId: String(args[0] || ''), message: String(args[1] || '') } })
      }
    }
  } catch (error) {
    if (!controller.signal.aborted) reportRuntimeError(error)
  }
}

function reportRuntimeError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  bootstrapState = { ...bootstrapState, dshReady: false, startupError: message }
  send('farmclaw:runtime-error', message)
}

async function startRuntime(): Promise<void> {
  const nodeExecutable = process.env.FARMCLAW_NODE_RUNTIME?.trim()
  if (!nodeExecutable) throw new Error('缺少 Node 26.8.1 运行时，请使用 desktop-shell npm start 启动')
  runtime = new DshRuntime({
    nodeExecutable,
    dshBin,
    patchFile: profilePatch,
    workspace: projectRoot,
    dshHome: path.join(app.getPath('userData'), 'dsh'),
    onLog: (line) => console.log(`[DSH] ${line}`),
    onExit: (code, signal) => {
      if (!quitting) reportRuntimeError(`官方 DSH 已退出：code=${code} signal=${signal}`)
    }
  })
  try {
    const startupUrl = await runtime.start()
    const activeClient = new DshClient(startupUrl)
    await activeClient.authenticate()
    client = activeClient
    bootstrapState = { ...bootstrapState, dshReady: true, startupError: '' }
    void startEvents(activeClient)
    send('farmclaw:runtime-ready')
  } catch (error) {
    client = null
    await runtime.stop()
    runtime = null
    throw error
  }
}

Menu.setApplicationMenu(null)
handle('farmclaw:bootstrap', () => bootstrapState)
handle('farmclaw:dsh-request', async (_event, method, payload) => {
  if (!client) throw new Error('官方 DSH 尚未启动')
  assertAllowedDshMethod(method)
  const mapped = mapDshRequest(method, payload)
  const value = mapped.endpoint === 'session/follow'
    ? await followSession(mapped.args)
    : await client.call(mapped.endpoint, mapped.args)
  return { result: { ok: true, value } }
})

app.whenReady().then(() => {
  configureSecurity()
  mainWindow = createWindow()
  void startRuntime().catch(reportRuntimeError)
})

app.on('before-quit', (event) => {
  if (quitting || !runtime) return
  event.preventDefault()
  quitting = true
  eventController?.abort()
  for (const controller of follows.values()) controller.abort()
  void runtime.stop().finally(() => {
    runtime = null
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
