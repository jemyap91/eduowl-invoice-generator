import type { TmRateTier } from "./types"

export interface RateTierDraft {
  key: string
  id?: string
  label: string
  parent_rate: string
  tutor_rate: string
}

export type RateTierValue = {
  label: string
  parent_rate: number
  tutor_rate: number
  sort_order: number
}

let keyCounter = 0
function nextKey(): string {
  keyCounter += 1
  return `tier-${Date.now().toString(36)}-${keyCounter}`
}

export function newDraft(partial: Partial<Omit<RateTierDraft, "key">> = {}): RateTierDraft {
  return { key: nextKey(), label: "", parent_rate: "", tutor_rate: "", ...partial }
}

export function draftsFromValues(values: RateTierValue[]): RateTierDraft[] {
  return values.map((v) =>
    newDraft({ label: v.label, parent_rate: String(v.parent_rate), tutor_rate: String(v.tutor_rate) })
  )
}

export function draftsFromTiers(tiers: TmRateTier[]): RateTierDraft[] {
  return [...tiers]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) =>
      newDraft({ id: t.id, label: t.label, parent_rate: String(t.parent_rate), tutor_rate: String(t.tutor_rate) })
    )
}

function parseRate(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
  return Math.round(parseFloat(trimmed) * 100) / 100
}

export type ValidateResult = { ok: true; tiers: RateTierValue[] } | { ok: false; error: string }

export function validateTiers(drafts: RateTierDraft[]): ValidateResult {
  if (drafts.length === 0) return { ok: false, error: "Add at least one rate tier." }
  const seen = new Set<string>()
  const tiers: RateTierValue[] = []
  for (const [i, d] of drafts.entries()) {
    const label = d.label.trim()
    if (!label) return { ok: false, error: "Every tier needs a label." }
    const lower = label.toLowerCase()
    if (seen.has(lower)) return { ok: false, error: `Tier label "${label}" is used more than once.` }
    seen.add(lower)
    const parent = parseRate(d.parent_rate)
    if (parent === null) return { ok: false, error: `Parent rate for "${label}" must be a number of 0 or more.` }
    const tutor = parseRate(d.tutor_rate)
    if (tutor === null) return { ok: false, error: `Tutor rate for "${label}" must be a number of 0 or more.` }
    tiers.push({ label, parent_rate: parent, tutor_rate: tutor, sort_order: i })
  }
  return { ok: true, tiers }
}

/** Tolerant reader for tm_settings.default_rate_tiers (jsonb). */
export function parseDefaultTiers(json: unknown): RateTierValue[] {
  if (!Array.isArray(json)) return []
  const out: RateTierValue[] = []
  for (const item of json) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    const label = typeof rec.label === "string" ? rec.label.trim() : ""
    const parent = typeof rec.parent_rate === "number" ? rec.parent_rate : parseRate(String(rec.parent_rate ?? ""))
    const tutor = typeof rec.tutor_rate === "number" ? rec.tutor_rate : parseRate(String(rec.tutor_rate ?? ""))
    if (!label || parent === null || tutor === null) continue
    out.push({ label, parent_rate: parent, tutor_rate: tutor, sort_order: out.length })
  }
  return out
}
