import { spawn, type ChildProcessByStdio } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import type { Readable } from 'node:stream'

import { isTrustedDshStartupUrl } from './security.js'

const STARTUP_PATTERN = /(?:^|\s)dsh\s+web:\s+(http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]{43})(?=\s|$)/iu
const STARTUP_TIMEOUT_MS = 240_000
const STOP_TIMEOUT_MS = 5_000

function extractStartupUrl(value: string): string | undefined {
  const normalized = value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '')
  const candidate = normalized.match(STARTUP_PATTERN)?.[1]
  return candidate && isTrustedDshStartupUrl(candidate) ? candidate : undefined
}

function redacted(value: string): string {
  return value.replace(/([?&]token=)[A-Za-z0-9_-]+/gu, '$1[redacted]')
}

function childEnvironment(overrides: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  const secret = /(?:api[_-]?key|access[_-]?token|(?:^|_)(?:secret|token)$)/iu
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !secret.test(key)) env[key] = value
  }
  Object.assign(env, overrides)
  return env
}

function waitForClose(child: ChildProcessByStdio<null, Readable, Readable>, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true)
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs)
    child.once('close', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

async function terminateWindowsTree(pid: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true
    })
    killer.once('error', () => resolve())
    killer.once('close', () => resolve())
  })
}

export type DshRuntimeOptions = {
  nodeExecutable: string
  dshBin: string
  patchFile: string
  workspace: string
  dshHome: string
  onLog?: (line: string) => void
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void
}

export class DshRuntime {
  private child: ChildProcessByStdio<null, Readable, Readable> | null = null

  constructor(private readonly options: DshRuntimeOptions) {}

  async start(): Promise<string> {
    if (this.child) throw new Error('官方 DSH 已在运行')
    for (const file of [this.options.nodeExecutable, this.options.dshBin, this.options.patchFile]) {
      if (!existsSync(file)) throw new Error(`DSH 启动文件不存在：${file}`)
    }
    if (!existsSync(this.options.workspace) || !statSync(this.options.workspace).isDirectory()) {
      throw new Error(`DSH 工作目录不可用：${this.options.workspace}`)
    }
    mkdirSync(this.options.dshHome, { recursive: true })

    const child = spawn(this.options.nodeExecutable, [
      this.options.dshBin,
      'web',
      '--patch',
      this.options.patchFile,
      '--host',
      '127.0.0.1',
      '--port',
      '0',
      '--no-open'
    ], {
      cwd: this.options.workspace,
      env: childEnvironment({ DSH_HOME: this.options.dshHome, DSH_CWD: this.options.workspace }),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
    this.child = child

    return new Promise((resolve, reject) => {
      let output = ''
      let settled = false
      const finish = (error?: Error, url?: string) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (error) reject(error)
        else resolve(url as string)
      }
      const inspect = (chunk: string) => {
        output = `${output}${chunk}`.slice(-16_000)
        for (const line of chunk.split(/\r?\n/u)) {
          const clean = redacted(line.trim())
          if (clean) this.options.onLog?.(clean)
        }
        const url = extractStartupUrl(output)
        if (url) finish(undefined, url)
      }
      const timer = setTimeout(() => {
        void this.stop().finally(() => finish(new Error(`官方 DSH 启动超时\n${redacted(output)}`)))
      }, STARTUP_TIMEOUT_MS)

      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', inspect)
      child.stderr.on('data', inspect)
      child.once('error', (error) => finish(error))
      child.once('close', (code, signal) => {
        if (this.child === child) this.child = null
        if (!settled) finish(new Error(`官方 DSH 在就绪前退出：code=${code} signal=${signal}`))
        else this.options.onExit?.(code, signal)
      })
    })
  }

  async stop(): Promise<void> {
    const child = this.child
    if (!child) return
    if (process.platform === 'win32' && child.pid) await terminateWindowsTree(child.pid)
    else child.kill('SIGTERM')
    if (!(await waitForClose(child, STOP_TIMEOUT_MS))) {
      child.kill('SIGKILL')
      await waitForClose(child, STOP_TIMEOUT_MS)
    }
    if (this.child === child) this.child = null
  }
}
