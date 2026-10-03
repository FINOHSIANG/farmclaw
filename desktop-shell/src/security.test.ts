import assert from 'node:assert/strict'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

import { isAllowedNavigationUrl, isTrustedDshStartupUrl, isTrustedRendererUrl } from './security.ts'

test('renderer privilege is restricted to the dashboard entry while allowing hash routes', () => {
  const entry = pathToFileURL('C:\\farmclaw\\dashboard\\index.html').href
  assert.equal(isTrustedRendererUrl(entry, entry), true)
  assert.equal(isTrustedRendererUrl(`${entry}#/index`, entry), true)
  assert.equal(isTrustedRendererUrl(`${entry}?debug=1`, entry), false)
  assert.equal(isTrustedRendererUrl('file:///C:/farmclaw/dashboard/other.html', entry), false)
  assert.equal(isAllowedNavigationUrl('https://example.com/', entry), false)
})

test('DSH startup URL accepts only a tokenized IPv4 loopback endpoint', () => {
  const token = 'A'.repeat(43)
  assert.equal(isTrustedDshStartupUrl(`http://127.0.0.1:43123/?token=${token}`), true)
  assert.equal(isTrustedDshStartupUrl(`http://localhost:43123/?token=${token}`), false)
  assert.equal(isTrustedDshStartupUrl(`http://127.0.0.1:43123/?token=${token}&debug=1`), false)
  assert.equal(isTrustedDshStartupUrl('https://127.0.0.1:43123/'), false)
})
