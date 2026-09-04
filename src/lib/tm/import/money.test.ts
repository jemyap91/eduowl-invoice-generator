import { describe, it, expect } from "vitest"
import { parseMoney } from "./money"

describe("parseMoney", () => {
  it("parses dollar amounts with separators", () => {
    expect(parseMoney("$1,840.00")).toBe(1840)
    expect(parseMoney("$560")).toBe(560)
    expect(parseMoney("S$120.00")).toBe(120)
    expect(parseMoney("487.9")).toBe(487.9)
    expect(parseMoney(" $0 ")).toBe(0)
  })
  it("returns null for blanks and non-numeric text", () => {
    expect(parseMoney("")).toBeNull()
    expect(parseMoney(undefined)).toBeNull()
    expect(parseMoney("No session")).toBeNull()
    expect(parseMoney("#REF!")).toBeNull()
    expect(parseMoney("Remainder")).toBeNull()
    expect(parseMoney("N/A")).toBeNull()
  })
})
