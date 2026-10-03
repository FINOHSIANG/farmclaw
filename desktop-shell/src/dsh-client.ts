import { randomUUID } from 'node:crypto'
import WebSocket, { type RawData } from 'ws'

import { isTrustedDshStartupUrl } from './security.js'

type JsonRecord = Record<string, unknown>

function record(value: unknown, message = 'DSH 响应格式无效'): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message)
  return value as JsonRecord
}

function cookies(headers: Headers): string[] {
  const getter = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  if (typeof getter === 'function') return getter.call(headers)
  const value = headers.get('set-cookie')
  return value ? value.split(/,(?=\s*[^;,=\s]+=[^;,]+)/u) : []
}

class AsyncQueue<T> {
  private values: T[] = []
  private waiters: Array<{ resolve: (value: IteratorResult<T>) => void; reject: (error: Error) => void }> = []
  private ended = false
  private error?: Error

  push(value: T): void {
    const waiter = this.waiters.shift()
    if (waiter) waiter.resolve({ done: false, value })
    else this.values.push(value)
  }

  end(error?: Error): void {
    this.ended = true
    this.error = error
    for (const waiter of this.waiters.splice(0)) {
      if (error) waiter.reject(error)
      else waiter.resolve({ done: true, value: undefined as never })
    }
  }

  next(): Promise<IteratorResult<T>> {
    if (this.values.length) return Promise.resolve({ done: false, value: this.values.shift() as T })
    if (this.error) return Promise.reject(this.error)
    if (this.ended) return Promise.resolve({ done: true, value: undefined as never })
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }))
  }
}

export class DshClient {
  private readonly startupUrl: URL
  private origin = ''
  private cookie = ''

  constructor(startupUrl: string) {
    if (!isTrustedDshStartupUrl(startupUrl)) throw new Error('官方 DSH 启动地址不可信')
    this.startupUrl = new URL(startupUrl)
  }

  async authenticate(signal?: AbortSignal): Promise<void> {
    const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000)
    const response = await fetch(this.startupUrl, { redirect: 'manual', signal: requestSignal })
    if (response.status !== 303 || response.headers.get('location') !== '/') {
      throw new Error(`官方 DSH 认证失败（HTTP ${response.status}）`)
    }
    const authCookies = cookies(response.headers)
      .map((item) => item.split(';', 1)[0]?.trim())
      .filter((item): item is string => Boolean(item && /^dsh-auth-[^=]+=.+$/u.test(item)))
    if (!authCookies.length) throw new Error('官方 DSH 认证未返回 Cookie')
    this.origin = this.startupUrl.origin
    this.cookie = authCookies.join('; ')
  }

  async call(endpoint: string, args: JsonRecord = {}, signal?: AbortSignal): Promise<unknown> {
    if (!this.origin || !this.cookie) throw new Error('官方 DSH 尚未认证')
    const rpcId = randomUUID()
    const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000)
    const response = await fetch(`${this.origin}/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: this.cookie },
      body: JSON.stringify({ type: 'client-request', rpcId, method: endpoint, payload: { args } }),
      signal: requestSignal
    })
    if (!response.ok) throw new Error(`DSH 请求失败（HTTP ${response.status}）`)
    const message = record(await response.json())
    if (message.type !== 'server-response' || message.rpcId !== rpcId) throw new Error('DSH 响应关联信息无效')
    const result = record(message.result, 'DSH 业务响应格式无效')
    if (result.ok !== true) {
      const failure = result.error && typeof result.error === 'object' ? result.error as JsonRecord : {}
      throw new Error(String(failure.message || 'DSH 业务请求失败'))
    }
    return result.value
  }

  async *stream(endpoint: string, args: JsonRecord, signal?: AbortSignal): AsyncIterable<unknown> {
    if (!this.origin || !this.cookie) throw new Error('官方 DSH 尚未认证')
    const queue = new AsyncQueue<unknown>()
    const streamId = randomUUID()
    const url = new URL('/api/remote.mux', this.origin)
    url.protocol = 'ws:'
    const socket = new WebSocket(url, { headers: { Cookie: this.cookie }, origin: this.origin })
    let closed = false
    const close = (error?: Error) => {
      if (closed) return
      closed = true
      queue.end(error)
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close()
    }
    const abort = () => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'cancel', streamId }))
      close()
    }
    signal?.addEventListener('abort', abort, { once: true })
    socket.once('error', (error) => close(error))
    socket.once('close', () => close())
    socket.on('message', (raw: RawData) => {
      try {
        const frame = record(JSON.parse(raw.toString()), 'DSH stream 帧无效')
        if (frame.streamId !== streamId) return
        if (frame.type === 'item') queue.push(frame.value)
        else if (frame.type === 'end') close()
        else if (frame.type === 'error') close(new Error(String(record(frame.error).message || 'DSH stream 失败')))
      } catch (error) {
        close(error instanceof Error ? error : new Error(String(error)))
      }
    })
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('open', resolve)
        socket.once('error', reject)
        socket.once('close', () => reject(new Error('DSH stream 在打开前关闭')))
      })
      socket.send(JSON.stringify({ type: 'open', streamId, endpoint, payload: { args } }))
      while (!signal?.aborted) {
        const item = await queue.next()
        if (item.done) return
        yield item.value
      }
    } finally {
      signal?.removeEventListener('abort', abort)
      close()
    }
  }
}
