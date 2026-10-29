export type TokenParts = {
  input: number
  output: number
  reasoning: number
  cache: {
    read: number
    write: number
  }
}

export type UsageEntry = {
  /** Stable id used for deduplication (usually assistant message id). */
  id: string
  sessionID: string
  ts: number
  tokens: number
}

export type QuotaStore = {
  entries: UsageEntry[]
}

export type QuotaSnapshot = {
  used: number
  limit: number
  remaining: number
  percent: number
  sessionUsed: number
  windowHours: number
  windowMs: number
  updatedAt: number
}

export function tokenTotal(tokens: TokenParts | undefined | null): number {
  if (!tokens) return 0
  const cache = tokens.cache ?? { read: 0, write: 0 }
  return (
    (tokens.input || 0) +
    (tokens.output || 0) +
    (tokens.reasoning || 0) +
    (cache.read || 0) +
    (cache.write || 0)
  )
}

export function emptyStore(): QuotaStore {
  return { entries: [] }
}

export function normalizeStore(value: unknown): QuotaStore {
  if (!value || typeof value !== "object") return emptyStore()
  const raw = value as { entries?: unknown }
  if (!Array.isArray(raw.entries)) return emptyStore()
  const entries: UsageEntry[] = []
  for (const item of raw.entries) {
    if (!item || typeof item !== "object") continue
    const entry = item as Partial<UsageEntry>
    if (typeof entry.id !== "string" || !entry.id) continue
    if (typeof entry.sessionID !== "string" || !entry.sessionID) continue
    if (typeof entry.ts !== "number" || !Number.isFinite(entry.ts)) continue
    if (typeof entry.tokens !== "number" || !Number.isFinite(entry.tokens) || entry.tokens < 0) continue
    entries.push({
      id: entry.id,
      sessionID: entry.sessionID,
      ts: entry.ts,
      tokens: Math.floor(entry.tokens),
    })
  }
  return { entries }
}

/** Drop entries older than the rolling window (with a small buffer for clock skew). */
export function pruneStore(store: QuotaStore, now: number, windowMs: number): QuotaStore {
  const cutoff = now - windowMs - 60_000
  return {
    entries: store.entries.filter((entry) => entry.ts >= cutoff),
  }
}

/**
 * Record a usage event. If the same id was already recorded, keep the higher token count
 * (covers late corrections) without double-counting.
 */
export function recordUsage(
  store: QuotaStore,
  entry: UsageEntry,
  now: number,
  windowMs: number,
): { store: QuotaStore; changed: boolean } {
  const next = pruneStore(store, now, windowMs)
  const index = next.entries.findIndex((item) => item.id === entry.id)
  if (index >= 0) {
    const previous = next.entries[index]!
    if (entry.tokens <= previous.tokens) {
      return { store: next, changed: false }
    }
    const entries = next.entries.slice()
    entries[index] = {
      ...previous,
      tokens: entry.tokens,
      ts: Math.max(previous.ts, entry.ts),
      sessionID: entry.sessionID || previous.sessionID,
    }
    return { store: { entries }, changed: true }
  }
  return {
    store: { entries: [...next.entries, entry] },
    changed: true,
  }
}

export function snapshot(
  store: QuotaStore,
  input: {
    limit: number
    windowMs: number
    windowHours: number
    sessionID?: string
    now?: number
  },
): QuotaSnapshot {
  const now = input.now ?? Date.now()
  const cutoff = now - input.windowMs
  let used = 0
  let sessionUsed = 0
  for (const entry of store.entries) {
    if (entry.ts < cutoff) continue
    used += entry.tokens
    if (input.sessionID && entry.sessionID === input.sessionID) {
      sessionUsed += entry.tokens
    }
  }
  const remaining = Math.max(0, input.limit - used)
  const percent = input.limit > 0 ? Math.min(100, (used / input.limit) * 100) : 0
  return {
    used,
    limit: input.limit,
    remaining,
    percent,
    sessionUsed,
    windowHours: input.windowHours,
    windowMs: input.windowMs,
    updatedAt: now,
  }
}
