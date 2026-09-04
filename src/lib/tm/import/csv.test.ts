import { describe, it, expect } from "vitest"
import { parseCsv } from "./csv"

describe("parseCsv", () => {
  it("splits simple rows and fields", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([["a", "b", "c"], ["1", "2", "3"]])
  })
  it("keeps empty fields", () => {
    expect(parseCsv("a,,c\n,,\n")).toEqual([["a", "", "c"], ["", "", ""]])
  })
  it("handles quoted fields with commas, newlines, and escaped quotes", () => {
    const text = '"Group: 80/hr\n1 to 1: 120/hr","$1,840.00","say ""hi"""\n'
    expect(parseCsv(text)).toEqual([["Group: 80/hr\n1 to 1: 120/hr", "$1,840.00", 'say "hi"']])
  })
  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\nc,d")).toEqual([["a", "b"], ["c", "d"]])
  })
})
