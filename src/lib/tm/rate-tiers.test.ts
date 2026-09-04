import { describe, it, expect } from "vitest"
import { validateTiers, parseDefaultTiers, draftsFromValues, newDraft } from "./rate-tiers"

describe("validateTiers", () => {
  it("accepts well-formed rows and assigns sort_order by position", () => {
    const result = validateTiers([
      { key: "a", label: "Group", parent_rate: "80", tutor_rate: "50" },
      { key: "b", label: " 1 to 1 ", parent_rate: "120.5", tutor_rate: "60" },
    ])
    expect(result).toEqual({
      ok: true,
      tiers: [
        { label: "Group", parent_rate: 80, tutor_rate: 50, sort_order: 0 },
        { label: "1 to 1", parent_rate: 120.5, tutor_rate: 60, sort_order: 1 },
      ],
    })
  })
  it("rejects an empty list", () => {
    expect(validateTiers([])).toEqual({ ok: false, error: "Add at least one rate tier." })
  })
  it("rejects a blank label", () => {
    expect(validateTiers([{ key: "a", label: "  ", parent_rate: "80", tutor_rate: "50" }]))
      .toEqual({ ok: false, error: "Every tier needs a label." })
  })
  it("rejects duplicate labels, case-insensitively", () => {
    expect(validateTiers([
      { key: "a", label: "Group", parent_rate: "80", tutor_rate: "50" },
      { key: "b", label: "group", parent_rate: "90", tutor_rate: "50" },
    ])).toEqual({ ok: false, error: 'Tier label "group" is used more than once.' })
  })
  it("rejects non-numeric or negative rates", () => {
    expect(validateTiers([{ key: "a", label: "Group", parent_rate: "abc", tutor_rate: "50" }]))
      .toEqual({ ok: false, error: 'Parent rate for "Group" must be a number of 0 or more.' })
    expect(validateTiers([{ key: "a", label: "Group", parent_rate: "80", tutor_rate: "-1" }]))
      .toEqual({ ok: false, error: 'Tutor rate for "Group" must be a number of 0 or more.' })
  })
})

describe("parseDefaultTiers", () => {
  it("reads a valid JSON array", () => {
    expect(parseDefaultTiers([{ label: "1 to 1", parent_rate: 70, tutor_rate: 50 }]))
      .toEqual([{ label: "1 to 1", parent_rate: 70, tutor_rate: 50, sort_order: 0 }])
  })
  it("accepts numeric strings and skips malformed entries", () => {
    expect(parseDefaultTiers([
      { label: "Group", parent_rate: "80", tutor_rate: "50" },
      { label: "", parent_rate: 1, tutor_rate: 1 },
      "junk",
      null,
    ])).toEqual([{ label: "Group", parent_rate: 80, tutor_rate: 50, sort_order: 0 }])
  })
  it("returns an empty list for anything else", () => {
    expect(parseDefaultTiers(null)).toEqual([])
    expect(parseDefaultTiers("[]")).toEqual([])
    expect(parseDefaultTiers({ label: "x" })).toEqual([])
  })
})

describe("drafts", () => {
  it("round-trips values to drafts with string rates and unique keys", () => {
    const drafts = draftsFromValues([
      { label: "Group", parent_rate: 80, tutor_rate: 50, sort_order: 0 },
      { label: "Zoom", parent_rate: 50, tutor_rate: 40, sort_order: 1 },
    ])
    expect(drafts.map((d) => [d.label, d.parent_rate, d.tutor_rate])).toEqual([
      ["Group", "80", "50"],
      ["Zoom", "50", "40"],
    ])
    expect(new Set(drafts.map((d) => d.key)).size).toBe(2)
  })
  it("newDraft starts blank with a fresh key", () => {
    const a = newDraft()
    const b = newDraft({ label: "Zoom" })
    expect(a).toMatchObject({ label: "", parent_rate: "", tutor_rate: "" })
    expect(b.label).toBe("Zoom")
    expect(a.key).not.toBe(b.key)
  })
})
