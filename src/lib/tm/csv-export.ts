export type CsvCell = string | number | boolean | null | undefined

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return ""
  if (typeof cell === "boolean") return cell ? "Yes" : "No"
  const s = String(cell)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** RFC 4180 CSV with CRLF line endings. Excel and Google Sheets open it directly. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(","))
  return lines.join("\r\n") + "\r\n"
}
