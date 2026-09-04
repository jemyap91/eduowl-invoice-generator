"use client"

import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer'

Font.register({
  family: 'Assistant',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/assistant/v24/2sDPZGJYnIjSi6H75xkZZE1I0yCmYzzQtuZnEGE.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/assistant/v24/2sDPZGJYnIjSi6H75xkZZE1I0yCmYzzQtgFgEGE.ttf', fontWeight: 700 },
  ]
})

const GREEN = '#1FAB89'
const TEXT = '#1A1A1A'
const MUTED = '#6B6B6B'
const ROW_ALT = '#F2F2F2'
const RULE = '#D9D9D9'

export interface InvoicePDFProps {
  academyName: string          // "EduOwl"
  academySubtitle: string      // "English Academy"
  academyAddress?: string | null
  academyPhone?: string | null
  academyEmail?: string | null
  logoUrl?: string
  qrCodeUrl?: string
  invoiceRef: string
  invoiceDate: string
  dueDate: string
  studentName: string
  parentName?: string | null
  parentEmail?: string | null
  parentPhone?: string | null
  month: number
  year: number
  items: {
    description: string
    hours: number | null
    hourlyRate: number | null
    total: number
    isAdhoc: boolean
    datesAttended?: string
  }[]
  subtotal: number
  paymentMethods: { name: string; details: string }[]
}

const styles = StyleSheet.create({
  page: { paddingTop: 0, paddingHorizontal: 48, paddingBottom: 48, fontFamily: 'Assistant', fontSize: 10, color: TEXT },
  topBar: { height: 8, backgroundColor: GREEN, marginHorizontal: -48, marginBottom: 28 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  academyName: { fontSize: 26, color: GREEN, fontWeight: 400 },
  academySubtitle: { fontSize: 13, color: GREEN, marginTop: 2 },
  academyDetail: { fontSize: 8, color: MUTED, marginTop: 2 },
  logo: { width: 170, height: 96, objectFit: 'contain' },
  billTo: { marginBottom: 26 },
  billToLine: { flexDirection: 'row', fontSize: 12, marginBottom: 4 },
  billToLabel: { fontWeight: 700 },
  billToIndent: { marginLeft: 76, fontSize: 11, marginBottom: 2 },
  billToMuted: { marginLeft: 76, fontSize: 9, color: MUTED },
  invoiceMeta: { fontSize: 8, color: MUTED, marginTop: 6 },
  rule: { borderBottomWidth: 1, borderBottomColor: RULE, marginBottom: 14 },
  tableHeader: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: RULE, color: GREEN, fontWeight: 700, fontSize: 11 },
  tableRow: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 2, fontSize: 10 },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 2, fontSize: 10, backgroundColor: ROW_ALT },
  colDesc: { flex: 3 },
  colHours: { flex: 0.8, textAlign: 'right' },
  colRate: { flex: 1.1, textAlign: 'right' },
  colTotal: { flex: 1.1, textAlign: 'right' },
  datesAttended: { fontSize: 7, color: MUTED, marginTop: 2 },
  discountText: { color: '#DC2626' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: RULE, paddingTop: 8, marginTop: 4 },
  paymentTitle: { color: GREEN, fontWeight: 700, fontSize: 10 },
  subtotalLabel: { color: GREEN, fontSize: 10, marginRight: 24 },
  subtotalValue: { fontWeight: 700, fontSize: 10, width: 70, textAlign: 'right' },
  paymentBlock: { marginTop: 16, gap: 8 },
  paymentMethod: { fontSize: 9 },
  paymentMethodName: { fontWeight: 700 },
  qrCode: { width: 96, height: 96, marginTop: 6 },
  grandTotal: { position: 'absolute', right: 48, bottom: 120, fontSize: 24, fontWeight: 700 },
})

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function formatCurrency(amount: number): string {
  if (amount < 0) return `-$${Math.abs(amount).toFixed(2)}`
  return `$${amount.toFixed(2)}`
}

export function InvoicePDF({
  academyName, academySubtitle, academyAddress, academyPhone, academyEmail,
  logoUrl, qrCodeUrl, invoiceRef, invoiceDate, dueDate,
  studentName, parentName, parentEmail, parentPhone,
  month, year, items, subtotal, paymentMethods,
}: InvoicePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} />

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.academyName}>{academyName}</Text>
            <Text style={styles.academySubtitle}>{academySubtitle}</Text>
            {academyAddress && <Text style={styles.academyDetail}>{academyAddress}</Text>}
            {academyPhone && <Text style={styles.academyDetail}>{academyPhone}</Text>}
            {academyEmail && <Text style={styles.academyDetail}>{academyEmail}</Text>}
          </View>
          {logoUrl && <Image src={logoUrl} style={styles.logo} />}
        </View>

        <View style={styles.billTo}>
          <View style={styles.billToLine}>
            <Text style={styles.billToLabel}>Invoice for:  </Text>
            <Text>{parentName || studentName}</Text>
          </View>
          {parentName && <Text style={styles.billToIndent}>{studentName}</Text>}
          <Text style={styles.billToMuted}>{monthNames[month - 1]} {year}</Text>
          {parentPhone && <Text style={styles.billToMuted}>{parentPhone}</Text>}
          {parentEmail && <Text style={styles.billToMuted}>{parentEmail}</Text>}
          <Text style={styles.invoiceMeta}>Invoice {invoiceRef}  ·  Issued {invoiceDate}  ·  Due {dueDate}</Text>
        </View>

        <View style={styles.rule} />

        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colHours}>Hours</Text>
          <Text style={styles.colRate}>Hourly Rate</Text>
          <Text style={styles.colTotal}>Total price</Text>
        </View>
        {items.map((item, i) => {
          const isDiscount = item.total < 0
          return (
            <View key={i} style={i % 2 === 0 ? styles.tableRowAlt : styles.tableRow}>
              <View style={styles.colDesc}>
                <Text style={isDiscount ? styles.discountText : {}}>{item.description}</Text>
                {item.datesAttended && <Text style={styles.datesAttended}>Dates: {item.datesAttended}</Text>}
              </View>
              <Text style={styles.colHours}>{item.hours ? item.hours.toString() : ''}</Text>
              <Text style={styles.colRate}>{item.hourlyRate ? formatCurrency(item.hourlyRate) : ''}</Text>
              <Text style={[styles.colTotal, isDiscount ? styles.discountText : {}]}>{formatCurrency(item.total)}</Text>
            </View>
          )
        })}

        <View style={styles.subtotalRow}>
          <Text style={styles.paymentTitle}>Payment Methods:</Text>
          <View style={{ flexDirection: 'row' }}>
            <Text style={styles.subtotalLabel}>Subtotal</Text>
            <Text style={styles.subtotalValue}>{formatCurrency(subtotal)}</Text>
          </View>
        </View>

        <View style={styles.paymentBlock}>
          {paymentMethods.map((pm, i) => (
            <View key={i} style={styles.paymentMethod}>
              <Text style={styles.paymentMethodName}>By {pm.name.toUpperCase()}:</Text>
              <Text>{pm.details}</Text>
            </View>
          ))}
          {qrCodeUrl && (
            <View style={styles.paymentMethod}>
              <Text style={styles.paymentMethodName}>By QR:</Text>
              <Image src={qrCodeUrl} style={styles.qrCode} />
            </View>
          )}
        </View>

        <Text style={styles.grandTotal}>{formatCurrency(subtotal)}</Text>
      </Page>
    </Document>
  )
}
