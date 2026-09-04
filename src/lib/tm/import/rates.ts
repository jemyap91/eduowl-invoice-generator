export interface ParsedRate {
  label: string
  rate: number
}

export interface RateTier {
  label: string
  parent_rate: number
  tutor_rate: number
  sort_order: number
}

const DEFAULT_LABEL = "1 to 1"

const LABEL_ALIASES: Record<string, string> = {
  "1 to 1": "1 to 1",
  "1-1": "1 to 1",
  "1:1": "1 to 1",
  "1 to 1 face-to-face": "1 to 1",
  f2f: "1 to 1",
  "face to face": "1 to 1",
  group: "Group",
  zoom: "Zoom",
  online: "Zoom",
}

export function normaliseLabel(raw: string): string {
  const key = raw.trim().toLowerCase()
  return LABEL_ALIASES[key] ?? raw.trim()
}

const RATE_LINE = /^\s*(?:([^:]+):)?\s*S?\$?\s*(\d+(?:\.\d+)?)\s*\/\s*hr\s*$/i

/** "Group: 80/hr\n1 to 1: 120/hr" -> two rates; "70/hr" -> one rate labelled "1 to 1". */
export function parseRateCell(cell: string | undefined): ParsedRate[] {
  if (!cell) return []
  const out: ParsedRate[] = []
  for (const line of cell.split(/\r?\n/)) {
    const m = line.match(RATE_LINE)
    if (!m) continue
    out.push({ label: m[1] ? normaliseLabel(m[1]) : DEFAULT_LABEL, rate: parseFloat(m[2]) })
  }
  return out
}

function sameLabel(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Combine the parent-rate cell and tutor-rate cell into tiers.
 * - Same labels on both sides: match by label.
 * - One tutor rate: applies to every parent tier.
 * - One parent rate but several tutor tiers: one tier per tutor label, all at the parent rate.
 * - No tutor rates: tutor_rate 0 (flagged as a warning by the caller).
 */
export function buildRateTiers(parentCell: string | undefined, tutorCell: string | undefined): RateTier[] {
  const parents = parseRateCell(parentCell)
  const tutors = parseRateCell(tutorCell)
  if (parents.length === 0) return []

  if (parents.length === 1 && tutors.length > 1) {
    return tutors.map((t, i) => ({
      label: t.label,
      parent_rate: parents[0].rate,
      tutor_rate: t.rate,
      sort_order: i,
    }))
  }

  return parents.map((p, i) => {
    const byLabel = tutors.find((t) => sameLabel(t.label, p.label))
    const tutorRate = byLabel?.rate ?? (tutors.length === 1 ? tutors[0].rate : tutors[i]?.rate ?? 0)
    return { label: p.label, parent_rate: p.rate, tutor_rate: tutorRate, sort_order: i }
  })
}
