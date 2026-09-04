import { describe, it, expect } from "vitest"
import { parseMonthLabel, parseMonthHeaders } from "./months"

describe("parseMonthLabel", () => {
  it("parses labels with and without years", () => {
    expect(parseMonthLabel("Jan")).toEqual({ month: 1, year: null })
    expect(parseMonthLabel("Sept")).toEqual({ month: 9, year: null })
    expect(parseMonthLabel("Dec 24")).toEqual({ month: 12, year: 2024 })
    expect(parseMonthLabel("August 26")).toEqual({ month: 8, year: 2026 })
    expect(parseMonthLabel("June 2025")).toEqual({ month: 6, year: 2025 })
  })
  it("rejects non-month headers", () => {
    expect(parseMonthLabel("No")).toBeNull()
    expect(parseMonthLabel("Deposit")).toBeNull()
    expect(parseMonthLabel("Monthly Est Profit")).toBeNull()
    expect(parseMonthLabel("")).toBeNull()
  })
})

describe("parseMonthHeaders", () => {
  it("infers missing years from the next labelled month, walking right to left", () => {
    const header = ["No", "Tutor", "Nov", "", "", "Dec 24", "", "", "Jan 25", "", "", "May 26", "", ""]
    expect(parseMonthHeaders(header, 2)).toEqual([
      { col: 2, year: 2024, month: 11 },
      { col: 5, year: 2024, month: 12 },
      { col: 8, year: 2025, month: 1 },
      { col: 11, year: 2026, month: 5 },
    ])
  })
  it("assigns the previous year when an unlabelled month is later in the year than the next labelled one", () => {
    const header = ["Nov", "", "", "Feb 25"]
    expect(parseMonthHeaders(header, 0)).toEqual([
      { col: 0, year: 2024, month: 11 },
      { col: 3, year: 2025, month: 2 },
    ])
  })
  it("drops months whose year cannot be inferred", () => {
    expect(parseMonthHeaders(["Jan", "", "", "Feb"], 0)).toEqual([])
  })
})
