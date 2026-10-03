export const ALLOWED_DSH_METHODS = new Set([
  'session.create',
  'session.prompt',
  'session.history',
  'session.cancel',
  'host.describe'
])

export function assertAllowedDshMethod(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !ALLOWED_DSH_METHODS.has(value)) {
    throw new Error(`不允许的 DSH 方法：${String(value)}`)
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function mapDshRequest(method: string, payload: unknown): { endpoint: string; args: Record<string, unknown> } {
  assertAllowedDshMethod(method)
  const request = record(payload)
  if (method === 'session.history') {
    return {
      endpoint: 'session/follow',
      args: {
        request: {
          address: { kind: 'session', sessionId: String(request.sessionId ?? '') },
          maxMessages: Number(request.maxMessages ?? 80),
          assistantStream: true
        }
      }
    }
  }
  if (method === 'session.prompt') {
    return {
      endpoint: 'session/prompt',
      args: { request: { ...request, requestId: crypto.randomUUID() } }
    }
  }
  if (method === 'session.cancel') return { endpoint: 'session/cancel', args: { request } }
  if (method === 'session.create') return { endpoint: 'session/create', args: { request } }
  return { endpoint: method.replace('.', '/'), args: request }
}
