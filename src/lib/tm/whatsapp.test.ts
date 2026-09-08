import { describe, it, expect } from "vitest"
import { whatsappText } from "./whatsapp"

describe("whatsappText", () => {
  it("renders the template with one rate line per tier", () => {
    const text = whatsappText({
      parentName: "Pat", studentName: "Sam", subject: "English", period: { year: 2026, month: 9 }, totalHours: 3.5,
      lines: [{ tierLabel: "1 to 1", rate: 70, hours: 2.5, total: 175 }, { tierLabel: "Group", rate: 40, hours: 1, total: 40 }],
      invoiceAmount: 215, paymentDetails: "PayNow UEN 202411710M",
    })
    expect(text).toBe([
      "Hi Pat, here's Sam's tuition invoice for September 2026:",
      "",
      "Subject: English",
      "Sessions: 3.50 hrs total",
      "Rate: $70.00/hr (1 to 1)",
      "Rate: $40.00/hr (Group)",
      "Amount due: $215.00",
      "",
      "Payment details: PayNow UEN 202411710M",
      "",
      "Thank you! — EduOwl Tutor Matching",
    ].join("\n"))
  })
  it("falls back to 'there' without a parent and omits hours and rates for a manual invoice", () => {
    const text = whatsappText({ parentName: null, studentName: "Sam", subject: "Math", period: { year: 2026, month: 1 }, totalHours: null, lines: [], invoiceAmount: 100, paymentDetails: "PayNow" })
    expect(text).toBe([
      "Hi there, here's Sam's tuition invoice for January 2026:",
      "",
      "Subject: Math",
      "Amount due: $100.00",
      "",
      "Payment details: PayNow",
      "",
      "Thank you! — EduOwl Tutor Matching",
    ].join("\n"))
  })
})
