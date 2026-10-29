import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { formatCompact, formatPercent, formatPillLabel, formatTooltipLines } from "./format.ts"
import {
  emptyStore,
  pruneStore,
  recordUsage,
  snapshot,
  tokenTotal,
} from "./quota.ts"

describe("tokenTotal", () => {
  it("sums every token field", () => {
    assert.equal(
      tokenTotal({
        input: 100,
        output: 20,
        reasoning: 5,
        cache: { read: 50, write: 10 },
      }),
      185,
    )
  })
})

describe("recordUsage", () => {
  it("accumulates distinct steps inside the window", () => {
    const now = 1_000_000
    let store = emptyStore()
    store = recordUsage(
      store,
      { id: "a", sessionID: "s1", ts: now - 1_000, tokens: 100 },
      now,
      4 * 60 * 60 * 1000,
    ).store
    store = recordUsage(
      store,
      { id: "b", sessionID: "s1", ts: now - 500, tokens: 50 },
      now,
      4 * 60 * 60 * 1000,
    ).store

    const current = snapshot(store, {
      limit: 15_000_000,
      windowMs: 4 * 60 * 60 * 1000,
      windowHours: 4,
      sessionID: "s1",
      now,
    })
    assert.equal(current.used, 150)
    assert.equal(current.sessionUsed, 150)
    assert.equal(current.remaining, 15_000_000 - 150)
  })

  it("does not double-count the same message id", () => {
    const now = 1_000_000
    let store = emptyStore()
    store = recordUsage(
      store,
      { id: "a", sessionID: "s1", ts: now, tokens: 100 },
      now,
      4 * 60 * 60 * 1000,
    ).store
    const again = recordUsage(
      store,
      { id: "a", sessionID: "s1", ts: now + 1, tokens: 100 },
      now + 1,
      4 * 60 * 60 * 1000,
    )
    assert.equal(again.changed, false)
    assert.equal(
      snapshot(again.store, {
        limit: 15_000_000,
        windowMs: 4 * 60 * 60 * 1000,
        windowHours: 4,
        now: now + 1,
      }).used,
      100,
    )
  })

  it("drops entries outside the rolling window", () => {
    const windowMs = 4 * 60 * 60 * 1000
    const now = 10_000_000
    let store = emptyStore()
    store = recordUsage(
      store,
      { id: "old", sessionID: "s1", ts: now - windowMs - 120_000, tokens: 999 },
      now,
      windowMs,
    ).store
    store = recordUsage(
      store,
      { id: "new", sessionID: "s1", ts: now - 1_000, tokens: 40 },
      now,
      windowMs,
    ).store
    store = pruneStore(store, now, windowMs)
    assert.equal(
      snapshot(store, { limit: 100, windowMs, windowHours: 4, now }).used,
      40,
    )
  })
})

describe("formatters", () => {
  it("formats compact pill labels like the chat badge", () => {
    assert.equal(formatCompact(560_000), "560K")
    assert.equal(formatCompact(15_000_000), "15M")
    assert.equal(formatPercent(3.7), "4%")
    assert.equal(
      formatPillLabel({
        used: 560_000,
        limit: 15_000_000,
        remaining: 14_440_000,
        percent: 3.733,
        sessionUsed: 560_000,
        windowHours: 4,
        windowMs: 4 * 60 * 60 * 1000,
        updatedAt: 0,
      }),
      "560K/15M • 4%",
    )
  })

  it("renders Russian tooltip lines", () => {
    const lines = formatTooltipLines(
      {
        used: 559_528,
        limit: 15_000_000,
        remaining: 14_440_472,
        percent: 3.73,
        sessionUsed: 559_528,
        windowHours: 4,
        windowMs: 4 * 60 * 60 * 1000,
        updatedAt: 0,
      },
      "ru",
    )
    assert.equal(lines[0], "Квота токенов (4 часа): 559,528 / 15,000,000 (4%).")
    assert.equal(lines[1], "Сессия: 559,528 токенов.")
    assert.equal(lines[2], "Осталось: 14,440,472")
  })
})
