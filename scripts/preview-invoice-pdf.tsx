import React from 'react'
import path from 'path'
import { renderToFile } from '@react-pdf/renderer'
import { InvoicePDF } from '../src/components/invoices/invoice-pdf'

const root = path.resolve(__dirname, '..')
const out = path.join(root, 'tmp', 'academy-invoice-preview.pdf')

async function main() {
  await renderToFile(
    <InvoicePDF
      academyName="EduOwl"
      academySubtitle="English Academy"
      logoUrl={path.join(root, 'public', 'academy', 'logo.png')}
      invoiceRef="INV-202607-001"
      invoiceDate="1 August 2026"
      dueDate="6 August 2026"
      studentName="Yang Xin"
      parentName="Ms Judy"
      month={7}
      year={2026}
      items={[
        { description: 'English 1-1 lesson with Mr Zi', hours: 4, hourlyRate: 120, total: 480, isAdhoc: false, datesAttended: '3, 10, 17, 24 Jul' },
        { description: 'G2 English TYS', hours: null, hourlyRate: null, total: 7.9, isAdhoc: true },
      ]}
      subtotal={487.9}
      paymentMethods={[{ name: 'PayNow', details: '97205889' }]}
    />,
    out,
  )
  console.log(`Wrote ${out}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
