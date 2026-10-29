import { createEffect, createSignal, type Accessor } from "solid-js"
import { Plugin } from "@opencode/plugin/tui"
import { formatPillLabel } from "./format.ts"
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
  id: "token-quota-tui",
  async setup(context) {
    const options = resolveOptions(context.options)
    const [quota, setQuota] = createSignal(
      emptySnapshot(options.limit || DEFAULT_LIMIT, options.windowHours || DEFAULT_WINDOW_HOURS, options.windowMs),
    )

    const refresh = async (sessionID?: string) => {
      try {
        const next = (await context.client.rpc(TokenQuota).get(sessionID ? { sessionID } : {})) as QuotaSnapshot
        setQuota(next)
      } catch {
        // ignore transient RPC failures
      }
    }

    void refresh()

    const unsubscribe = context.client.rpc(TokenQuota).events.on("updated", (event) => {
      setQuota(event.data.snapshot as QuotaSnapshot)
    })

    const timer = setInterval(() => {
      const route = context.ui.router.current()
      void refresh(route.type === "session" ? route.sessionID : undefined)
    }, 15_000)

    function Badge(props: { sessionID: Accessor<string | undefined> }) {
      createEffect(() => {
        void refresh(props.sessionID())
      })
      return <text>{formatPillLabel(quota())}</text>
    }

    const disposeSlot = context.ui.slot({
      append: "prompt.footer.status",
      render: (input) => <Badge sessionID={() => input.sessionID} />,
    })

    return () => {
      clearInterval(timer)
      unsubscribe()
      disposeSlot()
    }
  },
})
