export interface Period {
  year: number
  month: number // 1-12
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function periodKey(p: Period): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}`
}

export function periodLabel(p: Period): string {
  return `${SHORT_MONTHS[p.month - 1]} ${p.year}`
}

export function toMonthInput(p: Period): string {
  return periodKey(p)
}

export function parseMonthInput(value: string): Period | null {
  const m = value.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  if (month < 1 || month > 12) return null
  return { year, month }
}

export function currentPeriod(now: Date = new Date()): Period {
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function comparePeriods(a: Period, b: Period): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month
}

export function addMonths(p: Period, n: number): Period {
  const index = p.year * 12 + (p.month - 1) + n
  return { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1 }
}

export function periodsBetween(from: Period, to: Period): Period[] {
  const out: Period[] = []
  let cursor = from
  while (comparePeriods(cursor, to) <= 0) {
    out.push(cursor)
    cursor = addMonths(cursor, 1)
  }
  return out
}
