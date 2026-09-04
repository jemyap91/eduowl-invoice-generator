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
  it("neutralises cells that a spreadsheet would treat as formulas", () => {
    expect(toCsv(["v"], [["=SUM(A1)"], ["+1"], ["-x"], ["@cmd"], ["ok"]]))
      .toBe("v\r\n'=SUM(A1)\r\n'+1\r\n'-x\r\n'@cmd\r\nok\r\n")
  })
  it("leaves negative numbers alone and keeps CRLF inside a quoted cell", () => {
    expect(toCsv(["v"], [[-5], ["a\r\nb"]])).toBe('v\r\n-5\r\n"a\r\nb"\r\n')
  })
})
