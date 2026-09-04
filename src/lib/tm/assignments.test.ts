import { describe, it, expect } from "vitest"
import { suggestAssignmentCode } from "./assignments"

describe("suggestAssignmentCode", () => {
  it("uses the initials of the first two words plus a two-digit sequence", () => {
    expect(suggestAssignmentCode("Zhao Bin", [])).toBe("ZB01")
    expect(suggestAssignmentCode("Zhao Bin", ["ZB01"])).toBe("ZB02")
    expect(suggestAssignmentCode("Zhao Bin", ["ZB01", "ZB03"])).toBe("ZB04")
  })
  it("uses the first two letters of a single-word name", () => {
    expect(suggestAssignmentCode("David", [])).toBe("DA01")
    expect(suggestAssignmentCode("Ray", ["RA01"])).toBe("RA02")
  })
  it("joins sibling names on the ampersand", () => {
    expect(suggestAssignmentCode("Janice & Jeanie", [])).toBe("JJ01")
  })
  it("ignores codes with a different prefix and is case-insensitive", () => {
    expect(suggestAssignmentCode("Crystal", ["CR01", "cr02", "CH01"])).toBe("CR03")
  })
  it("falls back to XX for names with no letters", () => {
    expect(suggestAssignmentCode("  ", [])).toBe("XX01")
  })
})
