const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

export interface MonthColumn {
  col: number
  year: number
  month: number // 1-12
}

export function parseMonthLabel(label: string): { month: number; year: number | null } | null {
  const m = label.trim().match(/^([A-Za-z]+)\.?\s*(\d{2}|\d{4})?$/)
  if (!m) return null
  const idx = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase())
  if (idx < 0) return null
  const year = m[2] ? (m[2].length === 2 ? 2000 + parseInt(m[2], 10) : parseInt(m[2], 10)) : null
  return { month: idx + 1, year }
}

/**
 * Find month columns in the header row from `firstCol` onward. Labels without a
 * year take their year from the nearest labelled month to their right: the same
 * year if that month is later in the calendar, otherwise the year before.
 */
export function parseMonthHeaders(headerRow: string[], firstCol: number): MonthColumn[] {
  const raw: { col: number; month: number; year: number | null }[] = []
  for (let c = firstCol; c < headerRow.length; c++) {
    const parsed = parseMonthLabel(headerRow[c] ?? "")
    if (parsed) raw.push({ col: c, ...parsed })
  }

  let nextYear: number | null = null
  let nextMonth: number | null = null
  for (let i = raw.length - 1; i >= 0; i--) {
    const r = raw[i]
    if (r.year === null && nextYear !== null && nextMonth !== null) {
      r.year = r.month < nextMonth ? nextYear : nextYear - 1
    }
    if (r.year !== null) {
      nextYear = r.year
      nextMonth = r.month
    }
  }

  return raw
    .filter((r) => r.year !== null)
    .map((r) => ({ col: r.col, year: r.year as number, month: r.month }))
}
