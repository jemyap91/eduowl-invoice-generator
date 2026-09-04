export type CsvCell = string | number | boolean | null | undefined

const FORMULA_TRIGGERS = /^[=+\-@\t\r]/

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return ""
  if (typeof cell === "boolean") return cell ? "Yes" : "No"
  if (typeof cell === "number") return String(cell)
  // Neutralise spreadsheet formula injection: a leading apostrophe makes the cell literal text.
  const s = FORMULA_TRIGGERS.test(cell) ? `'${cell}` : cell
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** RFC 4180 CSV with CRLF line endings. Excel and Google Sheets open it directly. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(","))
  return lines.join("\r\n") + "\r\n"
}
