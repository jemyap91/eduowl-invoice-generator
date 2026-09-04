/**
 * Suggest a unique assignment code in the master list's style: initials of
 * the student's first two words (or first two letters of a single word),
 * upper-cased, plus a two-digit sequence that skips existing codes.
 */
export function suggestAssignmentCode(studentName: string, existingCodes: string[]): string {
  const words = studentName
    .replace(/&/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean)
  let prefix: string
  if (words.length >= 2) prefix = words[0][0] + words[1][0]
  else if (words.length === 1) prefix = words[0].slice(0, 2).padEnd(2, "X")
  else prefix = "XX"
  prefix = prefix.toUpperCase()

  const used = existingCodes
    .map((c) => c.toUpperCase())
    .filter((c) => c.startsWith(prefix) && /^\d+$/.test(c.slice(prefix.length)))
    .map((c) => parseInt(c.slice(prefix.length), 10))
  const n = (used.length ? Math.max(...used) : 0) + 1
  return `${prefix}${String(n).padStart(2, "0")}`
}
