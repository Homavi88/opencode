import { createEffect, createSignal, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { ComposerPill, Plugin } from "@opencode/plugin/gui"
import {
  formatExact,
  formatPercent,
  formatPillLabel,
  formatTooltipLines,
  toneFor,
  type Locale,
} from "./format.ts"
import { DEFAULT_LIMIT, DEFAULT_WINDOW_HOURS, resolveOptions } from "./options.ts"
import type { QuotaSnapshot } from "./quota.ts"
import { TokenQuota } from "./rpc.ts"

function emptySnapshot(limit: number, windowHours: number, windowMs: number): QuotaSnapshot {
  return {
    used: 0,
    limit,
    remaining: limit,
    percent: 0,
    sessionUsed: 0,
    windowHours,
    windowMs,
    updatedAt: Date.now(),
  }
}

export default Plugin.define({
  i18n: {
    en: {
      "pill.title": "Token quota",
      "row.quota": "Quota",
      "row.session": "Session",
      "row.remaining": "Remaining",
    },
    ru: {
      "pill.title": "Квота токенов",
      "row.quota": "Квота",
      "row.session": "Сессия",
      "row.remaining": "Осталось",
    },
  },
  setup(ctx) {
    const options = resolveOptions(ctx.options)
    const locale: Locale = options.locale
    const fallback = emptySnapshot(
      options.limit || DEFAULT_LIMIT,
      options.windowHours || DEFAULT_WINDOW_HOURS,
      options.windowMs,
    )
    const [windowQuota, setWindowQuota] = createSignal(fallback)
    const [perSession, setPerSession] = createStore<Record<string, QuotaSnapshot>>({})

    const apply = (next: QuotaSnapshot, sessionID?: string) => {
      setWindowQuota(next)
      if (sessionID) setPerSession(sessionID, next)
    }

    const refresh = async (sessionID?: string) => {
      try {
        const next = (await ctx.client.rpc(TokenQuota).get(sessionID ? { sessionID } : {})) as QuotaSnapshot
        apply(next, sessionID)
      } catch {
        // Server may be restarting; keep the last known value.
      }
    }

    createEffect(() => {
      const sessionID = ctx.sessions.current()?.id
      void refresh(sessionID)
    })

    const unsubscribe = ctx.client.rpc(TokenQuota).events.on("updated", (event) => {
      const data = event.data as { snapshot: QuotaSnapshot; sessionID?: string }
      apply(data.snapshot, data.sessionID)
      const current = ctx.sessions.current()?.id
      if (current && data.sessionID && data.sessionID !== current) {
        void refresh(current)
      }
    })

    const timer = setInterval(() => {
      void refresh(ctx.sessions.current()?.id)
    }, 15_000)

    onCleanup(() => {
      clearInterval(timer)
      unsubscribe()
    })

    ctx.add(ComposerPill, {
      id: "usage",
      order: 50,
      show: (input) => {
        const sessionID = input.session.id
        const current = perSession[sessionID] ?? windowQuota()
        // Ask for a session-scoped snapshot the first time this composer mounts.
        if (!perSession[sessionID]) void refresh(sessionID)

        const lines = formatTooltipLines(current, locale)
        return {
          icon: "window-analytics",
          label: formatPillLabel(current),
          tone: toneFor(current.percent),
          title: lines[0] ?? ctx.t("pill.title"),
          rows: [
            {
              id: "quota",
              label: lines[0] ?? ctx.t("row.quota"),
              icon: "window-analytics",
              tone: toneFor(current.percent),
              detail: formatPercent(current.percent),
            },
            {
              id: "session",
              label: lines[1] ?? ctx.t("row.session"),
              icon: "speech-bubble",
              detail: formatExact(current.sessionUsed),
            },
            {
              id: "remaining",
              label: lines[2] ?? ctx.t("row.remaining"),
              icon: "status",
              detail: formatExact(current.remaining),
            },
          ],
        }
      },
    })
  },
})
