import { describe, it, expect } from "vitest"
import { parseRateCell, buildRateTiers } from "./rates"

describe("parseRateCell", () => {
  it("parses a single unlabeled rate as 1 to 1", () => {
    expect(parseRateCell("70/hr")).toEqual([{ label: "1 to 1", rate: 70 }])
  })
  it("parses labeled multi-line rates", () => {
    expect(parseRateCell("Group: 80/hr\n1 to 1: 120/hr")).toEqual([
      { label: "Group", rate: 80 },
      { label: "1 to 1", rate: 120 },
    ])
  })
  it("normalises label aliases", () => {
    expect(parseRateCell("Zoom: 40/hr\nf2f: 50/hr")).toEqual([
      { label: "Zoom", rate: 40 },
      { label: "1 to 1", rate: 50 },
    ])
  })
  it("returns nothing for prose", () => {
    expect(parseRateCell("Tutor will collect payment herself")).toEqual([])
    expect(parseRateCell("")).toEqual([])
    expect(parseRateCell(undefined)).toEqual([])
  })
})

describe("buildRateTiers", () => {
  it("pairs a single parent rate with a single tutor rate", () => {
    expect(buildRateTiers("70/hr", "50/hr")).toEqual([
      { label: "1 to 1", parent_rate: 70, tutor_rate: 50, sort_order: 0 },
    ])
  })
  it("matches multi-tier parent and tutor cells by label", () => {
    expect(buildRateTiers("Group: 80/hr\n1 to 1: 120/hr", "Group: 80/hr\n1 to 1: 120/hr")).toEqual([
      { label: "Group", parent_rate: 80, tutor_rate: 80, sort_order: 0 },
      { label: "1 to 1", parent_rate: 120, tutor_rate: 120, sort_order: 1 },
    ])
  })
  it("applies a single tutor rate to every parent tier", () => {
    expect(buildRateTiers("Group: 80/hr\n1 to 1: 120/hr", "50/hr")).toEqual([
      { label: "Group", parent_rate: 80, tutor_rate: 50, sort_order: 0 },
      { label: "1 to 1", parent_rate: 120, tutor_rate: 50, sort_order: 1 },
    ])
  })
  it("expands a single parent rate across multiple tutor tiers", () => {
    expect(buildRateTiers("50/hr", "Zoom: 40/hr\nf2f: 50/hr")).toEqual([
      { label: "Zoom", parent_rate: 50, tutor_rate: 40, sort_order: 0 },
      { label: "1 to 1", parent_rate: 50, tutor_rate: 50, sort_order: 1 },
    ])
  })
  it("uses tutor rate 0 when the tutor cell has no rates", () => {
    expect(buildRateTiers("1 to 1: 65/hr", "")).toEqual([
      { label: "1 to 1", parent_rate: 65, tutor_rate: 0, sort_order: 0 },
    ])
  })
  it("returns nothing when the parent cell has no rates", () => {
    expect(buildRateTiers("Tutor will collect payment herself", "")).toEqual([])
  })
})
