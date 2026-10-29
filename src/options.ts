/** Default rolling token quota: 15 million tokens every 4 hours. */
export const DEFAULT_LIMIT = 15_000_000
export const DEFAULT_WINDOW_HOURS = 4

export type PluginOptions = {
  /** Absolute token budget for the rolling window. Default: 15_000_000. */
  limit?: number
  /** Rolling window length in hours. Default: 4. */
  windowHours?: number
  /** UI language for the chat badge. Default: "ru". */
  locale?: "ru" | "en"
}

export type ResolvedOptions = {
  limit: number
  windowMs: number
  windowHours: number
  locale: "ru" | "en"
}

export function resolveOptions(raw: unknown): ResolvedOptions {
  const options = (raw && typeof raw === "object" ? raw : {}) as PluginOptions
  const limit =
    typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit > 0
      ? Math.floor(options.limit)
      : DEFAULT_LIMIT
  const windowHours =
    typeof options.windowHours === "number" &&
    Number.isFinite(options.windowHours) &&
    options.windowHours > 0
      ? options.windowHours
      : DEFAULT_WINDOW_HOURS
  const locale = options.locale === "en" ? "en" : "ru"
  return {
    limit,
    windowHours,
    windowMs: Math.round(windowHours * 60 * 60 * 1000),
    locale,
  }
}
