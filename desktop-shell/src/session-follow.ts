type JsonRecord = Record<string, unknown>

export type HistoryEntry = { event: JsonRecord }
export type SessionHistory = { events: HistoryEntry[]; hasMore: boolean }

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

export function normalizeSessionSnapshot(snapshot: unknown): { history: SessionHistory; cursor: number } {
  const value = record(snapshot)
  const events = Array.isArray(value.records)
    ? value.records.flatMap((candidate): HistoryEntry[] => {
      const item = record(candidate)
      const event = record(item.event)
      return item.type === 'event' && Object.keys(event).length ? [{ event }] : []
    })
    : []
  return {
    history: { events, hasMore: value.hasMore === true },
    cursor: typeof value.cursor === 'number' ? value.cursor : -1
  }
}
