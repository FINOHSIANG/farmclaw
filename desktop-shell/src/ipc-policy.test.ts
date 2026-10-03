import assert from 'node:assert/strict'
import test from 'node:test'

import { ALLOWED_DSH_METHODS, assertAllowedDshMethod, mapDshRequest } from './ipc-policy.ts'

test('IPC exposes only the required DSH control surface', () => {
  assert.deepEqual([...ALLOWED_DSH_METHODS].sort(), [
    'host.describe',
    'session.cancel',
    'session.create',
    'session.history',
    'session.prompt'
  ])
  assert.throws(() => assertAllowedDshMethod('workspace.delete'), /不允许/)
})

test('legacy renderer methods map to official DSH endpoints', () => {
  assert.equal(mapDshRequest('session.create', { cwd: 'E:\\workspace\\farmclaw' }).endpoint, 'session/create')
  assert.equal(mapDshRequest('session.prompt', { sessionId: 's1' }).endpoint, 'session/prompt')
  assert.deepEqual(mapDshRequest('session.cancel', { sessionId: 's1' }).args, { request: { sessionId: 's1' } })
  assert.equal(mapDshRequest('session.history', { sessionId: 's1' }).endpoint, 'session/follow')
})
