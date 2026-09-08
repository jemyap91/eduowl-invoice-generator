"use client"

import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer"
import { MONTH_NAMES } from "@/lib/format"
import type { Period } from "@/lib/tm/periods"
import type { InvoiceLine } from "@/lib/tm/invoices"

Font.register({
  family: "Assistant",
  fonts: [
    { src: "https://fonts.gstatic.com/s/assistant/v24/2sDPZGJYnIjSi6H75xkZZE1I0yCmYzzQtuZnEGE.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/assistant/v24/2sDPZGJYnIjSi6H75xkZZE1I0yCmYzzQtgFgEGE.ttf", fontWeight: 700 },
  ],
})

const NAVY = "#2E3192"
const TEXT = "#1A1A1A"
const MUTED = "#6B6B6B"
const ROW_ALT = "#F2F2F2"
const RULE = "#D9D9D9"

export interface TmInvoicePDFProps {
  companyName: string
  legalName: string
  logoUrl?: string
  qrCodeUrl?: string
  invoiceNumber: string
  parentName: string | null
  address: string | null
  studentName: string
  period: Period
  lines: InvoiceLine[]
  subtotal: number
  paymentTerms: string
  paynowUen: string
}

const styles = StyleSheet.create({
  page: { paddingTop: 0, paddingHorizontal: 48, paddingBottom: 48, fontFamily: "Assistant", fontSize: 10, color: TEXT },
  topBar: { height: 10, backgroundColor: NAVY, marginHorizontal: -48, marginBottom: 28 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  companyName: { fontSize: 26, color: NAVY, fontWeight: 400 },
  legalName: { fontSize: 13, color: NAVY, marginTop: 2 },
  logo: { width: 150, height: 150, objectFit: "contain" },
  billTo: { marginBottom: 22 },
  billToLine: { flexDirection: "row", fontSize: 12, marginBottom: 4 },
  billToLabel: { fontWeight: 700 },
  billToIndent: { marginLeft: 76, fontSize: 11, marginBottom: 2 },
  billToMuted: { marginLeft: 76, fontSize: 9, color: MUTED },
  rule: { borderBottomWidth: 1, borderBottomColor: RULE, marginBottom: 14 },
  tableHeader: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: RULE, color: NAVY, fontWeight: 700, fontSize: 11 },
  tableRow: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 2, fontSize: 10 },
  tableRowAlt: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 2, fontSize: 10, backgroundColor: ROW_ALT },
  colDesc: { flex: 3 },
  colHours: { flex: 0.8, textAlign: "right" },
  colRate: { flex: 1.1, textAlign: "right" },
  colTotal: { flex: 1.1, textAlign: "right" },
  subtotalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: RULE, paddingTop: 8, marginTop: 4 },
  paymentTitle: { color: NAVY, fontWeight: 700, fontSize: 10 },
  subtotalLabel: { color: NAVY, fontSize: 10, marginRight: 24 },
  subtotalValue: { fontWeight: 700, fontSize: 10, width: 70, textAlign: "right" },
  paymentBlock: { marginTop: 10, gap: 8, width: 300 },
  paymentMethod: { fontSize: 9 },
  paymentMethodName: { fontWeight: 700 },
  qrCode: { width: 110, height: 110, marginTop: 6 },
  grandTotal: { position: "absolute", right: 48, bottom: 140, fontSize: 24, fontWeight: 700, color: "#E0218A" },
})

function money(n: number): string {
  return `$${n.toFixed(2)}`
}

export function TmInvoicePDF(p: TmInvoicePDFProps) {
  const monthLabel = `${MONTH_NAMES[p.period.month - 1]} ${p.period.year}`
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} />

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{p.companyName}</Text>
            <Text style={styles.legalName}>{p.legalName}</Text>
            <View style={{ marginTop: 22 }}>
              <View style={styles.billToLine}>
                <Text style={styles.billToLabel}>Invoice for:  </Text>
                <Text>{p.parentName || p.studentName}</Text>
              </View>
              {(p.address ?? "").split("\n").filter(Boolean).map((line, i) => (
                <Text key={i} style={styles.billToIndent}>{line}</Text>
              ))}
              <Text style={styles.billToIndent}>{p.studentName}, {monthLabel}</Text>
              <Text style={styles.billToMuted}>Invoice {p.invoiceNumber}</Text>
            </View>
          </View>
          {p.logoUrl && <Image src={p.logoUrl} style={styles.logo} />}
        </View>

        <View style={styles.rule} />

        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colHours}>Hours</Text>
          <Text style={styles.colRate}>Hourly Rate</Text>
          <Text style={styles.colTotal}>Total price</Text>
        </View>
        {p.lines.map((line, i) => (
          <View key={i} style={i % 2 === 0 ? styles.tableRowAlt : styles.tableRow}>
            <Text style={styles.colDesc}>{line.description}</Text>
            <Text style={styles.colHours}>{line.hours === null ? "" : line.hours.toFixed(2).replace(/\.?0+$/, "")}</Text>
            <Text style={styles.colRate}>{line.rate === null ? "" : money(line.rate)}</Text>
            <Text style={styles.colTotal}>{money(line.total)}</Text>
          </View>
        ))}

        <View style={styles.subtotalRow}>
          <Text style={styles.paymentTitle}>Payment Methods:</Text>
          <View style={{ flexDirection: "row" }}>
            <Text style={styles.subtotalLabel}>Subtotal</Text>
            <Text style={styles.subtotalValue}>{money(p.subtotal)}</Text>
          </View>
        </View>

        <View style={styles.paymentBlock}>
          <Text style={styles.paymentMethod}>{p.paymentTerms}</Text>
          <View style={styles.paymentMethod}>
            <Text style={styles.paymentMethodName}>By PAYNOW:</Text>
            <Text style={styles.paymentMethodName}>UEN: {p.paynowUen}</Text>
          </View>
          {p.qrCodeUrl && (
            <View style={styles.paymentMethod}>
              <Text style={styles.paymentMethodName}>By QR:</Text>
              <Image src={p.qrCodeUrl} style={styles.qrCode} />
            </View>
          )}
        </View>

        <Text style={styles.grandTotal}>{money(p.subtotal)}</Text>
      </Page>
    </Document>
  )
}
