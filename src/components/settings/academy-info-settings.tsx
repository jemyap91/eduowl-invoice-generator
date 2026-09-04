"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

interface AcademyInfo {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
}

export function AcademyInfoSettings() {
  const [info, setInfo] = useState<AcademyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const { toast } = useToast()

  async function fetchInfo() {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("academy_info")
      .select("*")
      .limit(1)
      .single()
    if (error && error.code !== "PGRST116") {
      toast({ title: "Error", description: "Failed to load academy info", variant: "destructive" })
    }
    if (data) {
      setInfo(data)
      setName(data.name || "")
      setAddress(data.address || "")
      setPhone(data.phone || "")
      setEmail(data.email || "")
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: name.trim(),
      address: address.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
    }

    if (info) {
      const { error } = await supabase
        .from("academy_info")
        .update(payload)
        .eq("id", info.id)
      if (error) {
        toast({ title: "Error", description: "Failed to update academy info", variant: "destructive" })
      } else {
        toast({ title: "Success", description: "Academy info updated successfully" })
      }
    } else {
      const { data, error } = await supabase
        .from("academy_info")
        .insert(payload)
        .select()
        .single()
      if (error) {
        toast({ title: "Error", description: "Failed to save academy info", variant: "destructive" })
      } else {
        setInfo(data)
        toast({ title: "Success", description: "Academy info saved successfully" })
      }
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8">Loading...</div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Academy Information</CardTitle>
        <CardDescription>
          Update your academy&apos;s contact details. This information appears on invoices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="academy-name">Name</Label>
          <Input
            id="academy-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pegasus Learning Academy"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="academy-address">Address</Label>
          <Textarea
            id="academy-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 123 Orchard Road, #01-01, Singapore 238888"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="academy-phone">Phone</Label>
            <Input
              id="academy-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +65 9720 5889"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="academy-email">Email</Label>
            <Input
              id="academy-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. info@pegasus.sg"
            />
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
