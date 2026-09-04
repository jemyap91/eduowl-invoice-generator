"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, FileEdit } from "lucide-react"
import { InvoiceList } from "@/components/invoices/invoice-list"
import { GenerateInvoiceForm } from "@/components/invoices/generate-invoice-form"
import { ManualInvoiceForm } from "@/components/invoices/manual-invoice-form"

export default function InvoicesPage() {
  const [generateOpen, setGenerateOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  function handleGenerated() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button onClick={() => setManualOpen(true)} size="sm" variant="outline">
          <FileEdit className="mr-2 h-4 w-4" />
          Create Manual Invoice
        </Button>
        <Button onClick={() => setGenerateOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Generate Invoice
        </Button>
      </div>

      <InvoiceList key={refreshKey} />

      <GenerateInvoiceForm
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerated={handleGenerated}
      />

      <ManualInvoiceForm
        open={manualOpen}
        onOpenChange={setManualOpen}
        onGenerated={handleGenerated}
      />
    </div>
  )
}
