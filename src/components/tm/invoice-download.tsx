"use client"

import { pdf } from "@react-pdf/renderer"
import { invoiceLines } from "@/lib/tm/approvals"
import { invoiceFileName, manualLine, type InvoiceLine, type InvoiceRow } from "@/lib/tm/invoices"
import { loadInvoiceContext } from "./invoice-data"
import { TmInvoicePDF } from "./invoice-pdf"

async function toDataUri(path: string): Promise<string> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Could not load ${path}`)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(`Could not read ${path}`))
    reader.readAsDataURL(blob)
  })
}

/** Builds the PDF for one invoice and triggers the browser download. Throws on any failure. */
export async function downloadInvoicePdf(row: InvoiceRow): Promise<void> {
  const { settings, entries } = await loadInvoiceContext(row)
  const lines: InvoiceLine[] = row.source === "generated"
    ? invoiceLines(entries).map((l) => ({ description: `${row.studentName} ${row.subject} (${l.tierLabel})`, hours: l.hours, rate: l.rate, total: l.total }))
    : [manualLine(row)]
  const [logoUrl, qrCodeUrl] = await Promise.all([toDataUri("/tm/logo.png"), toDataUri(settings.qr_code_path)])

  const blob = await pdf(
    <TmInvoicePDF
      companyName={settings.company_name}
      legalName={settings.legal_name}
      logoUrl={logoUrl}
      qrCodeUrl={qrCodeUrl}
      invoiceNumber={row.invoice_number ?? ""}
      parentName={row.parentName}
      address={row.address}
      studentName={row.studentName}
      period={{ year: row.year, month: row.month }}
      lines={lines}
      subtotal={row.invoice_amount}
      paymentTerms={settings.payment_terms}
      paynowUen={settings.paynow_uen}
    />,
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = invoiceFileName(row)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
