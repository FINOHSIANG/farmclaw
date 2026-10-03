import path from 'node:path'
import { fileURLToPath } from 'node:url'

function parseUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function sameFile(candidate: URL, expected: URL): boolean {
  if (candidate.protocol !== 'file:' || expected.protocol !== 'file:') return false
  if (candidate.username || candidate.password || candidate.search) return false
  try {
    return path.resolve(fileURLToPath(candidate)) === path.resolve(fileURLToPath(expected))
  } catch {
    return false
  }
}

export function isTrustedRendererUrl(candidate: string, expectedEntryUrl: string): boolean {
  const actual = parseUrl(candidate)
  const expected = parseUrl(expectedEntryUrl)
  return Boolean(actual && expected && sameFile(actual, expected))
}

export function isAllowedNavigationUrl(candidate: string, expectedEntryUrl: string): boolean {
  return isTrustedRendererUrl(candidate, expectedEntryUrl)
}

export function isTrustedDshStartupUrl(value: string): boolean {
  const url = parseUrl(value)
  if (!url || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !/^\d+$/u.test(url.port)) return false
  if (url.pathname !== '/' || url.username || url.password || url.hash) return false
  const tokens = url.searchParams.getAll('token')
  return tokens.length === 1
    && /^[A-Za-z0-9_-]{43}$/u.test(tokens[0] ?? '')
    && [...url.searchParams.keys()].every((key) => key === 'token')
}
