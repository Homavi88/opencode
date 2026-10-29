import { Plugin } from "@opencode/plugin"
import { formatReport } from "./format.ts"
import { resolveOptions } from "./options.ts"
import {
  emptyStore,
  normalizeStore,
  recordUsage,
  snapshot,
  tokenTotal,
  type QuotaStore,
  type TokenParts,
} from "./quota.ts"
import { TokenQuota } from "./rpc.ts"

const STORAGE_KEY = "store"

type StepTokens = TokenParts | undefined

function asTokens(value: unknown): StepTokens {
  if (!value || typeof value !== "object") return undefined
  const tokens = value as Partial<TokenParts> & { cache?: Partial<TokenParts["cache"]> }
  return {
    input: typeof tokens.input === "number" ? tokens.input : 0,
    output: typeof tokens.output === "number" ? tokens.output : 0,
    reasoning: typeof tokens.reasoning === "number" ? tokens.reasoning : 0,
    cache: {
      read: typeof tokens.cache?.read === "number" ? tokens.cache.read : 0,
      write: typeof tokens.cache?.write === "number" ? tokens.cache.write : 0,
    },
  }
}

export default Plugin.define({
  id: "token-quota",
  async setup(ctx) {
    const options = resolveOptions(ctx.options)
    let store: QuotaStore = normalizeStore(await ctx.storage.get(STORAGE_KEY))
    let saveChain: Promise<void> = Promise.resolve()

    const persist = (next: QuotaStore) => {
      store = next
      saveChain = saveChain
        .then(() => ctx.storage.set(STORAGE_KEY, next as never))
        .catch(() => undefined)
      return saveChain
    }

    const readSnapshot = (sessionID?: string) =>
      snapshot(store, {
        limit: options.limit,
        windowMs: options.windowMs,
        windowHours: options.windowHours,
        sessionID,
      })

    const registration = await ctx.rpc.register(TokenQuota, {
      get: async (input) => {
        const sessionID =
          input && typeof input === "object" && typeof (input as { sessionID?: unknown }).sessionID === "string"
            ? (input as { sessionID: string }).sessionID
            : undefined
        return readSnapshot(sessionID)
      },
    })

    const publish = async (sessionID?: string) => {
      const current = readSnapshot(sessionID)
      await registration.events.emit("updated", {
        snapshot: current,
        ...(sessionID ? { sessionID } : {}),
      })
    }

    const ingest = async (input: {
      id: string
      sessionID: string
      ts: number
      tokens: StepTokens
    }) => {
      const total = tokenTotal(input.tokens)
      if (!input.id || !input.sessionID || total <= 0) return
      const result = recordUsage(
        store,
        {
          id: input.id,
          sessionID: input.sessionID,
          ts: input.ts,
          tokens: total,
        },
        Date.now(),
        options.windowMs,
      )
      if (!result.changed) return
      await persist(result.store)
      await publish(input.sessionID)
    }

    await ctx.command.transform((editor) => {
      editor.add({
        name: "quota",
        description:
          options.locale === "en"
            ? "Show the rolling token quota"
            : "Показать квоту токенов",
        execute: async ({ sessionID }) => {
          await ctx.session.synthetic({
            sessionID,
            text: formatReport(readSnapshot(sessionID), options.locale),
          })
        },
      })
    })

    const controller = new AbortController()
    void (async () => {
      for await (const event of ctx.event.subscribe({
        signal: controller.signal,
        types: ["session.step.ended"],
      })) {
        if (event.type !== "session.step.ended") continue
        await ingest({
          id: event.data.assistantMessageID,
          sessionID: event.data.sessionID,
          ts: event.created,
          tokens: asTokens(event.data.tokens),
        })
      }
    })()

    // Keep the pill honest as the rolling window slides forward.
    const timer = setInterval(() => {
      void publish()
    }, 30_000)

    return async () => {
      clearInterval(timer)
      controller.abort()
      await saveChain
      await registration.dispose()
    }
  },
})
