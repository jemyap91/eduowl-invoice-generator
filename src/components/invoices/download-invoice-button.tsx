"use client"

import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { InvoicePDF } from './invoice-pdf'
import { useToast } from '@/hooks/use-toast'

interface DownloadInvoiceButtonProps {
  invoiceId: string
  studentName: string
  month: number
  year: number
  variant?: "outline" | "ghost"
  size?: "sm" | "icon"
  iconOnly?: boolean
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export function DownloadInvoiceButton({
  invoiceId,
  studentName,
  month,
  year,
  variant = "outline",
  size = "sm",
  iconOnly = false,
}: DownloadInvoiceButtonProps) {
  const [generating, setGenerating] = useState(false)
  const { toast } = useToast()

  async function handleDownload() {
    setGenerating(true)
    try {
      const supabase = createClient()

      // Fetch all data in parallel
      const [itemsRes, paymentRes, academyRes, invoiceRes] = await Promise.all([
        supabase
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', invoiceId)
          .order('is_adhoc')
          .order('created_at'),
        supabase
          .from('payment_methods')
          .select('name, details')
          .order('display_order'),
        supabase
          .from('academy_info')
          .select('name, address, phone, email')
          .single(),
        supabase
          .from('invoices')
          .select('id, invoice_number, created_at, parent_id, student_id, parents(name, email, phone), students(name)')
          .eq('id', invoiceId)
          .single(),
      ])

      const items = itemsRes.data || []
      const paymentMethods = paymentRes.data || []
      const academy = academyRes.data
      const invoice = invoiceRes.data

      const subtotal = items.reduce((sum, item) => sum + parseFloat(item.total as unknown as string), 0)

      const invoiceRef = invoice?.invoice_number || `INV-${invoiceId.slice(0, 8).toUpperCase()}`
      const now = new Date()
      const invoiceDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      const dueDateObj = new Date(now)
      dueDateObj.setDate(dueDateObj.getDate() + 5)
      const dueDate = dueDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

      // Parent info from the invoice's parent relation
      const parent = invoice?.parents as unknown as { name: string; email: string | null; phone: string | null } | null
      const student = invoice?.students as unknown as { name: string } | null

      // Pre-fetch images as data URIs to avoid react-pdf silent fetch failures
      async function toDataUri(path: string): Promise<string> {
        const res = await fetch(path)
        const imgBlob = await res.blob()
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(imgBlob)
        })
      }

      const logoUrl = await toDataUri('/academy/logo.png')

      const blob = await pdf(
        <InvoicePDF
          academyName="EduOwl"
          academySubtitle={academy?.name?.replace(/^EduOwl\s*/i, '') || 'English Academy'}
          academyAddress={academy?.address}
          academyPhone={academy?.phone}
          academyEmail={academy?.email}
          logoUrl={logoUrl}
          invoiceRef={invoiceRef}
          invoiceDate={invoiceDate}
          dueDate={dueDate}
          studentName={student?.name || studentName}
          parentName={parent?.name || ""}
          parentEmail={parent?.email}
          parentPhone={parent?.phone}
          month={month}
          year={year}
          items={items.map(item => ({
            description: item.description,
            hours: item.hours ? parseFloat(item.hours as unknown as string) : null,
            hourlyRate: item.hourly_rate ? parseFloat(item.hourly_rate as unknown as string) : null,
            total: parseFloat(item.total as unknown as string),
            isAdhoc: item.is_adhoc ?? false,
            datesAttended: item.dates_attended || undefined,
          }))}
          subtotal={subtotal}
          paymentMethods={paymentMethods}
        />
      ).toBlob()

      // Trigger download
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${student?.name || studentName} ${monthNames[month - 1]}'${String(year).slice(-2)} Invoice.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({ title: 'Success', description: 'Invoice PDF downloaded' })
    } catch (error) {
      console.error('PDF generation error:', error)
      toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' })
    }
    setGenerating(false)
  }

  if (iconOnly) {
    return (
      <Button
        onClick={handleDownload}
        disabled={generating}
        variant={variant}
        size="icon"
        title="Download PDF"
      >
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
    )
  }

  return (
    <Button onClick={handleDownload} disabled={generating} variant={variant} size={size}>
      {generating ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
      ) : (
        <><Download className="mr-2 h-4 w-4" /> Download PDF</>
      )}
    </Button>
  )
}
