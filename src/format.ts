import type { QuotaSnapshot } from "./quota.ts"

/** Compact token count for the composer pill: 560K, 15M, 1.2M. */
export function formatCompact(value: number): string {
  const n = Math.max(0, Math.floor(value))
  if (n < 1_000) return String(n)
  if (n < 1_000_000) {
    const k = n / 1_000
    return `${trimDecimal(k)}K`
  }
  const m = n / 1_000_000
  return `${trimDecimal(m)}M`
}

function trimDecimal(value: number): string {
  if (value >= 100) return String(Math.round(value))
  if (value >= 10) {
    const rounded = Math.round(value * 10) / 10
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  }
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function formatExact(value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString("en-US")
}

export function formatPercent(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) return "0%"
  if (percent < 1) return `${percent.toFixed(1)}%`
  return `${Math.round(percent)}%`
}

export function formatPillLabel(snapshot: QuotaSnapshot): string {
  return `${formatCompact(snapshot.used)}/${formatCompact(snapshot.limit)} • ${formatPercent(snapshot.percent)}`
}

export function toneFor(percent: number): "success" | "warning" | "danger" | undefined {
  if (percent >= 90) return "danger"
  if (percent >= 70) return "warning"
  return undefined
}

export type Locale = "ru" | "en"

function formatWindowLabel(hours: number, locale: Locale): string {
  const value = Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
  if (locale === "en") return `${value}h`

  const whole = Math.floor(hours)
  if (!Number.isInteger(hours)) return `${value} ч`
  const mod100 = whole % 100
  const mod10 = whole % 10
  if (mod100 >= 11 && mod100 <= 14) return `${value} часов`
  if (mod10 === 1) return `${value} час`
  if (mod10 >= 2 && mod10 <= 4) return `${value} часа`
  return `${value} часов`
}

export function formatTooltipLines(snapshot: QuotaSnapshot, locale: Locale): string[] {
  const used = formatExact(snapshot.used)
  const limit = formatExact(snapshot.limit)
  const percent = formatPercent(snapshot.percent)
  const remaining = formatExact(snapshot.remaining)
  const session = formatExact(snapshot.sessionUsed)
  const window = formatWindowLabel(snapshot.windowHours, locale)

  if (locale === "en") {
    return [
      `Token quota (${window}): ${used} / ${limit} (${percent}).`,
      `Session: ${session} tokens.`,
      `Remaining: ${remaining}`,
    ]
  }

  return [
    `Квота токенов (${window}): ${used} / ${limit} (${percent}).`,
    `Сессия: ${session} токенов.`,
    `Осталось: ${remaining}`,
  ]
}

export function formatReport(snapshot: QuotaSnapshot, locale: Locale): string {
  return formatTooltipLines(snapshot, locale).join("\n")
}
