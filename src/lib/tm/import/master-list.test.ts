import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { parseMasterList } from "./master-list"

const HEADER_FIXED = "No,Tutor,Tutor's Number,Student,Parent's Name,Subject,Address,Timeslot,Timesheet,Deposit,Parent's Payment Rate,Tutor's Pay Rate,Curriculum Briefed?,Group Chat Created?,Checked in?,Monthly Est Profit,Remarks,Additional Materials "
const FIXTURE = [
  `${HEADER_FIXED},Dec 25,,,Jan 26,,,May 26,,`,
  `,,,,,,,,,,,,,,,,,,Invoice Amt,Tutor Pay,Diff,Invoice Amt,Tutor Pay,Diff,Invoice Amt,Tutor Pay,Diff`,
  `JAJE01,Guan Wen,9634 2496,Janice & Jeanie,Debbie Ang,Sec G2 Eng,Clementi,Sat 2-4pm,Guan Wen's Timesheet,N/A,70/hr,50/hr,Y,Y,,160,,,No session,,,$560.00,$400.00,$160.00,$700,$500,$200`,
  `ZB02,Zijie,9720 5889,Zhao Bin,Li Shiwei,Foundational Eng,,,Zijie's Timesheet,$960.00,"Group: 80/hr\n1 to 1: 120/hr","Group: 80/hr\n1 to 1: 120/hr",,,,,Owe ZB $330,,#REF!,,,$960.00,$960.00,$0.00,,,$0`,
  `R01,Madeline,9101 5596,Ray,Petrina,S3 G2 Chem,Blk 849,,NA(Tutor collects payment herself),N/A,Tutor will collect payment herself,,,,,,,,,,,$300,$0,$300,,,`,
  `R01,Shashank,,Rayyan,Stacy,S2 G3 Science,,,,$360.00,45/hr,35/hr,,,,,,,,,,,,,,,`,
  `,,,,,,,,,,,,,,,,,,,,,,,,,,,`,
  `,Continue,,Move to English Academy,,,,,,,,,,,,,,,,,,,,,,,,`,
].join("\n")

describe("parseMasterList (fixture)", () => {
  const result = parseMasterList(FIXTURE, { "R01:Rayyan": "RY01" })

  it("returns one assignment per row with a code, skipping legend rows", () => {
    expect(result.assignments.map((a) => a.code)).toEqual(["JAJE01", "ZB02", "R01", "RY01"])
  })

  it("maps the fixed columns", () => {
    const a = result.assignments[0]
    expect(a).toMatchObject({
      code: "JAJE01",
      tutor_name: "Guan Wen",
      tutor_phone: "9634 2496",
      student_name: "Janice & Jeanie",
      parent_name: "Debbie Ang",
      subject: "Sec G2 Eng",
      address: "Clementi",
      timeslot: "Sat 2-4pm",
      deposit_amount: null,
      deposit_status: "none",
      curriculum_briefed: true,
      group_chat_created: true,
      post_trial_checkin_done: false,
      monthly_est_profit: 160,
      remarks: null,
      additional_materials: null,
      status: "active",
    })
    expect(a.rate_tiers).toEqual([{ label: "1 to 1", parent_rate: 70, tutor_rate: 50, sort_order: 0 }])
  })

  it("reads monthly invoices as (year, month, amount, payout) and skips blanks and text", () => {
    expect(result.assignments[0].invoices).toEqual([
      { year: 2026, month: 1, invoice_amount: 560, tutor_payout: 400 },
      { year: 2026, month: 5, invoice_amount: 700, tutor_payout: 500 },
    ])
    expect(result.assignments[1].invoices).toEqual([
      { year: 2026, month: 1, invoice_amount: 960, tutor_payout: 960 },
    ])
  })

  it("records deposits as collected and multi-line rate tiers", () => {
    const zb = result.assignments[1]
    expect(zb.deposit_amount).toBe(960)
    expect(zb.deposit_status).toBe("collected")
    expect(zb.remarks).toBe("Owe ZB $330")
    expect(zb.rate_tiers.map((t) => t.label)).toEqual(["Group", "1 to 1"])
  })

  it("marks tutor-collects rows as stopped with no tiers and warns", () => {
    const r = result.assignments[2]
    expect(r.status).toBe("stopped")
    expect(r.rate_tiers).toEqual([])
    expect(r.invoices).toEqual([{ year: 2026, month: 1, invoice_amount: 300, tutor_payout: 0 }])
    expect(result.warnings.some((w) => w.includes("R01") && w.includes("no rate tiers"))).toBe(true)
  })

  it("applies code overrides for duplicates and warns about them", () => {
    expect(result.assignments[3].code).toBe("RY01")
    expect(result.assignments[3].deposit_amount).toBe(360)
    expect(result.warnings.some((w) => w.includes("RY01"))).toBe(true)
  })

  it("suffixes unexpected duplicate codes", () => {
    const dup = parseMasterList(FIXTURE, {})
    expect(dup.assignments[3].code).toBe("R01-2")
  })
})

describe("parseMasterList (real export)", () => {
  const file = path.resolve(__dirname, "../../../../docs/reference/Tutor Matching (Invoicing) - Demo New MasterList.csv")
  const result = parseMasterList(fs.readFileSync(file, "utf8"), { "R01:Rayyan": "RY01" })

  it("finds all 35 assignments with unique codes", () => {
    expect(result.assignments).toHaveLength(35)
    expect(new Set(result.assignments.map((a) => a.code)).size).toBe(35)
  })

  it("reads JAJE01 history from the last four month blocks", () => {
    const a = result.assignments.find((x) => x.code === "JAJE01")!
    expect(a.invoices).toEqual([
      { year: 2026, month: 5, invoice_amount: 560, tutor_payout: 400 },
      { year: 2026, month: 6, invoice_amount: 560, tutor_payout: 400 },
      { year: 2026, month: 7, invoice_amount: 700, tutor_payout: 500 },
    ])
  })

  it("reads ET02's zoom and face-to-face tutor tiers", () => {
    const a = result.assignments.find((x) => x.code === "ET02")!
    expect(a.rate_tiers).toEqual([
      { label: "Zoom", parent_rate: 50, tutor_rate: 40, sort_order: 0 },
      { label: "1 to 1", parent_rate: 50, tutor_rate: 50, sort_order: 1 },
    ])
  })
})
