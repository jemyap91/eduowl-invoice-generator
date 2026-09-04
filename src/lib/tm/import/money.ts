/** "$1,840.00" -> 1840, "S$120.00" -> 120, "No session" -> null */
export function parseMoney(cell: string | undefined): number | null {
  if (!cell) return null
  const cleaned = cell.replace(/S?\$/g, "").replace(/,/g, "").trim()
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  return Math.round(parseFloat(cleaned) * 100) / 100
}
