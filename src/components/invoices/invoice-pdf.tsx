"use client"

import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer'

Font.register({
  family: 'Assistant',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/assistant/v24/2sDPZGJYnIjSi6H75xkZZE1I0yCmYzzQtuZnEGE.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/assistant/v24/2sDPZGJYnIjSi6H75xkZZE1I0yCmYzzQtgFgEGE.ttf', fontWeight: 700 },
  ]
})

const TEAL = '#54ABA7'
const TEXT = '#515151'
const MUTED = '#7A7A7A'
const LIGHT_BG = '#F7FAFA'
const BORDER = '#D4E8EA'

interface InvoicePDFProps {
  academyName: string
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
  paymentMethods: {
    name: string
    details: string
  }[]
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 60,
    fontFamily: 'Assistant',
    fontSize: 10,
    color: TEXT,
  },
  // Header row: logo+name on left, INVOICE on right
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: TEAL,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
  },
  academyNameBlock: {
    gap: 2,
  },
  academyName: {
    fontSize: 16,
    fontWeight: 700,
    color: TEAL,
  },
  academyDetail: {
    fontSize: 8,
    color: MUTED,
  },
  invoiceBadge: {
    fontSize: 28,
    fontWeight: 700,
    color: TEAL,
    letterSpacing: 2,
  },
  // Info row: From / To / Invoice details
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  infoBlock: {
    flex: 1,
  },
  infoBlockRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: TEAL,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 10,
    marginBottom: 2,
    color: TEXT,
  },
  infoTextMuted: {
    fontSize: 9,
    color: MUTED,
    marginBottom: 1,
  },
  // Table
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: TEAL,
    color: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontWeight: 700,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    fontSize: 10,
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: LIGHT_BG,
    fontSize: 10,
  },
  tableRowDiscount: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    fontSize: 10,
  },
  colDesc: { flex: 3 },
  colHours: { flex: 0.8, textAlign: 'right' },
  colRate: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1, textAlign: 'right' },
  discountText: { color: '#DC2626' },
  datesAttended: { fontSize: 7, color: MUTED, marginTop: 2 },
  // Totals
  totalsBlock: {
    marginTop: 2,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    width: 200,
  },
  totalLabel: {
    flex: 1,
    textAlign: 'right',
    fontSize: 10,
    paddingRight: 12,
    color: MUTED,
  },
  totalValue: {
    width: 80,
    textAlign: 'right',
    fontSize: 10,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 8,
    width: 200,
    borderTopWidth: 2,
    borderTopColor: TEAL,
    marginTop: 2,
  },
  grandTotalLabel: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: 700,
    paddingRight: 12,
    color: TEXT,
  },
  grandTotalValue: {
    width: 80,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: 700,
    color: TEAL,
  },
  // Payment info with QR code
  paymentInfoSection: {
    marginTop: 28,
    flexDirection: 'row',
    gap: 20,
    padding: 14,
    backgroundColor: LIGHT_BG,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
  },
  qrCode: {
    width: 100,
    height: 100,
  },
  paymentInfoDetails: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  paymentInfoTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: TEAL,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    fontSize: 9,
    color: TEXT,
    marginBottom: 2,
  },
  paymentInfoLabel: {
    fontWeight: 700,
    width: 120,
  },
  // Notes
  notesSection: {
    marginTop: 20,
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.5,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#AAA',
  },
})

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function formatCurrency(amount: number): string {
  if (amount < 0) return `-$${Math.abs(amount).toFixed(2)}`
  return `$${amount.toFixed(2)}`
}

export function InvoicePDF({
  academyName, academyAddress, academyPhone, academyEmail,
  logoUrl, qrCodeUrl, invoiceRef, invoiceDate, dueDate,
  studentName, parentName, parentEmail, parentPhone,
  month, year, items, subtotal, paymentMethods,
}: InvoicePDFProps) {
  const positiveTotal = items.filter(i => i.total > 0).reduce((s, i) => s + i.total, 0)
  const discountTotal = items.filter(i => i.total < 0).reduce((s, i) => s + Math.abs(i.total), 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {logoUrl && <Image src={logoUrl} style={styles.logo} />}
            <View style={styles.academyNameBlock}>
              <Text style={styles.academyName}>{academyName}</Text>
              {academyAddress && <Text style={styles.academyDetail}>{academyAddress}</Text>}
              {academyPhone && <Text style={styles.academyDetail}>{academyPhone}</Text>}
              {academyEmail && <Text style={styles.academyDetail}>{academyEmail}</Text>}
            </View>
          </View>
          <Text style={styles.invoiceBadge}>INVOICE</Text>
        </View>

        {/* Bill To / Invoice Details */}
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Bill To</Text>
            <Text style={styles.infoText}>{studentName}</Text>
            {parentName && <Text style={styles.infoTextMuted}>c/o {parentName}</Text>}
            {parentEmail && <Text style={styles.infoTextMuted}>{parentEmail}</Text>}
            {parentPhone && <Text style={styles.infoTextMuted}>{parentPhone}</Text>}
          </View>
          <View style={styles.infoBlockRight}>
            <Text style={styles.infoLabel}>Invoice Details</Text>
            <Text style={styles.infoText}>Invoice #: {invoiceRef}</Text>
            <Text style={styles.infoTextMuted}>Date: {invoiceDate}</Text>
            <Text style={styles.infoTextMuted}>Due: {dueDate}</Text>
            <Text style={styles.infoTextMuted}>Period: {monthNames[month - 1]} {year}</Text>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colHours}>Hours</Text>
            <Text style={styles.colRate}>Rate</Text>
            <Text style={styles.colTotal}>Amount</Text>
          </View>
          {items.map((item, i) => {
            const isDiscount = item.total < 0
            const baseStyle = isDiscount
              ? styles.tableRowDiscount
              : (i % 2 === 0 ? styles.tableRow : styles.tableRowAlt)
            return (
              <View key={i} style={baseStyle}>
                <View style={styles.colDesc}>
                  <Text style={isDiscount ? styles.discountText : {}}>
                    {item.description}
                  </Text>
                  {item.datesAttended && (
                    <Text style={styles.datesAttended}>Dates: {item.datesAttended}</Text>
                  )}
                </View>
                <Text style={styles.colHours}>
                  {item.hours ? item.hours.toString() : '—'}
                </Text>
                <Text style={styles.colRate}>
                  {item.hourlyRate ? formatCurrency(item.hourlyRate) : '—'}
                </Text>
                <Text style={[styles.colTotal, isDiscount ? styles.discountText : {}]}>
                  {formatCurrency(item.total)}
                </Text>
              </View>
            )
          })}
        </View>

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(positiveTotal)}</Text>
          </View>
          {discountTotal > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={[styles.totalValue, styles.discountText]}>-{formatCurrency(discountTotal)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Due</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(subtotal)}</Text>
          </View>
        </View>

        {/* Payment Info with QR Code */}
        <View style={styles.paymentInfoSection}>
          {qrCodeUrl && <Image src={qrCodeUrl} style={styles.qrCode} />}
          <View style={styles.paymentInfoDetails}>
            <Text style={styles.paymentInfoTitle}>Payment Details</Text>
            <View style={styles.paymentInfoRow}>
              <Text style={styles.paymentInfoLabel}>PayNow UEN:</Text>
              <Text>202314247Z</Text>
            </View>
            <View style={styles.paymentInfoRow}>
              <Text style={styles.paymentInfoLabel}>DBS Account No:</Text>
              <Text>072-984-499-2</Text>
            </View>
            {paymentMethods.map((pm, i) => (
              <View key={i} style={styles.paymentInfoRow}>
                <Text style={styles.paymentInfoLabel}>{pm.name}:</Text>
                <Text>{pm.details}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesTitle}>Notes</Text>
          <Text style={styles.notesText}>
            Thank you for choosing {academyName}. Payment is due within 5 days of the invoice date.
          </Text>
          <Text style={styles.notesText}>
            Please include the invoice reference number with your payment.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{academyName}</Text>
          <Text style={styles.footerText}>Invoice #{invoiceRef} — {monthNames[month - 1]} {year}</Text>
          <Text style={styles.footerText}>Page 1 of 1</Text>
        </View>
      </Page>
    </Document>
  )
}
