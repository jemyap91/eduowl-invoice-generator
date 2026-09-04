import { describe, it, expect } from "vitest"
import {
  periodKey, periodLabel, currentPeriod, parseMonthInput, toMonthInput, comparePeriods, addMonths, periodsBetween,
} from "./periods"

describe("periods", () => {
  it("formats keys and labels", () => {
    expect(periodKey({ year: 2026, month: 8 })).toBe("2026-08")
    expect(periodLabel({ year: 2026, month: 8 })).toBe("Aug 2026")
    expect(toMonthInput({ year: 2026, month: 12 })).toBe("2026-12")
  })
  it("parses month inputs and rejects junk", () => {
    expect(parseMonthInput("2026-08")).toEqual({ year: 2026, month: 8 })
    expect(parseMonthInput("2026-13")).toBeNull()
    expect(parseMonthInput("")).toBeNull()
    expect(parseMonthInput("abc")).toBeNull()
  })
  it("derives the current period from a date", () => {
    expect(currentPeriod(new Date(2026, 8, 4))).toEqual({ year: 2026, month: 9 })
  })
  it("compares and adds months across year boundaries", () => {
    expect(comparePeriods({ year: 2025, month: 12 }, { year: 2026, month: 1 })).toBeLessThan(0)
    expect(comparePeriods({ year: 2026, month: 3 }, { year: 2026, month: 3 })).toBe(0)
    expect(addMonths({ year: 2026, month: 11 }, 3)).toEqual({ year: 2027, month: 2 })
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
  })
  it("lists inclusive ranges ascending, empty when reversed", () => {
    expect(periodsBetween({ year: 2025, month: 11 }, { year: 2026, month: 2 }).map(periodKey))
      .toEqual(["2025-11", "2025-12", "2026-01", "2026-02"])
    expect(periodsBetween({ year: 2026, month: 2 }, { year: 2026, month: 1 })).toEqual([])
  })
})
