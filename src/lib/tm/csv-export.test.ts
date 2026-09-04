import { describe, it, expect } from "vitest"
import { toCsv } from "./csv-export"

describe("toCsv", () => {
  it("writes a header row and CRLF-terminated data rows", () => {
    expect(toCsv(["a", "b"], [["1", 2], ["x", null]])).toBe("a,b\r\n1,2\r\nx,\r\n")
  })
  it("quotes fields containing commas, quotes, or newlines and doubles quotes", () => {
    expect(toCsv(["v"], [['say "hi", ok'], ["line1\nline2"]]))
      .toBe('v\r\n"say ""hi"", ok"\r\n"line1\nline2"\r\n')
  })
  it("renders booleans as Yes/No and undefined as empty", () => {
    expect(toCsv(["f"], [[true], [false], [undefined]])).toBe("f\r\nYes\r\nNo\r\n\r\n")
  })
})
