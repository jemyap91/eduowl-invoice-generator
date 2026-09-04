"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { RateTierEditor } from "./rate-tier-editor"
import { draftsFromValues, parseDefaultTiers, validateTiers, type RateTierDraft } from "@/lib/tm/rate-tiers"
import type { TmSettings } from "@/lib/tm/types"

export function SettingsForm() {
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [legalName, setLegalName] = useState("")
  const [paymentTerms, setPaymentTerms] = useState("")
  const [paynowUen, setPaynowUen] = useState("")
  const [paymentDetails, setPaymentDetails] = useState("")
  const [tiers, setTiers] = useState<RateTierDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase.from("tm_settings").select("*").limit(1).maybeSingle()
      if (error || !data) {
        toast({ title: "Error", description: "Failed to load settings", variant: "destructive" })
        setLoadFailed(true)
        setLoading(false)
        return
      }
      const s = data as TmSettings
      setSettingsId(s.id)
      setCompanyName(s.company_name)
      setLegalName(s.legal_name)
      setPaymentTerms(s.payment_terms)
      setPaynowUen(s.paynow_uen)
      setPaymentDetails(s.payment_details)
      setTiers(draftsFromValues(parseDefaultTiers(s.default_rate_tiers)))
      setLoading(false)
    }
    load()
  }, [toast])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!settingsId) return
    const validated = tiers.length === 0 ? { ok: true as const, tiers: [] } : validateTiers(tiers)
    if (!validated.ok) {
      toast({ title: "Check the rate tier template", description: validated.error, variant: "destructive" })
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("tm_settings")
      .update({
        company_name: companyName.trim(),
        legal_name: legalName.trim(),
        payment_terms: paymentTerms.trim(),
        paynow_uen: paynowUen.trim(),
        payment_details: paymentDetails.trim(),
        default_rate_tiers: validated.tiers.map(({ label, parent_rate, tutor_rate }) => ({ label, parent_rate, tutor_rate })),
      })
      .eq("id", settingsId)
    setSaving(false)
    if (error) {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" })
      return
    }
    toast({ title: "Saved", description: "Tutor Matching settings updated" })
  }

  if (loading) {
    return <Skeleton className="h-64 w-full" />
  }

  if (loadFailed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Settings could not be loaded</CardTitle>
          <CardDescription>Check your connection and try again.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => window.location.reload()}>Retry</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
          <CardDescription>Shown on Tutor Matching invoices.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company name</Label>
            <Input id="company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal-name">Legal name</Label>
            <Input id="legal-name" value={legalName} onChange={(e) => setLegalName(e.target.value)} required />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
          <CardDescription>Used on the invoice PDF and in the WhatsApp message.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="paynow-uen">PayNow UEN</Label>
            <Input id="paynow-uen" value={paynowUen} onChange={(e) => setPaynowUen(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-details">Payment details (WhatsApp text)</Label>
            <Input id="payment-details" value={paymentDetails} onChange={(e) => setPaymentDetails(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-terms">Payment terms (PDF)</Label>
            <Textarea id="payment-terms" rows={3} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} required />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default rate tiers</CardTitle>
          <CardDescription>Pre-filled on every new assignment. Leave empty to start assignments blank.</CardDescription>
        </CardHeader>
        <CardContent>
          <RateTierEditor value={tiers} onChange={setTiers} idPrefix="default-tier" />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button>
      </div>
    </form>
  )
}
