"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DialogFooter } from "@/components/ui/dialog"

export interface StudentFormValues {
  name: string
  parent_name: string
  parent_phone: string
  contact_preference: string
  address: string
  remarks: string
}

interface StudentFormProps {
  onSubmit: (values: StudentFormValues) => Promise<void>
  onCancel: () => void
  defaultValues?: Partial<StudentFormValues>
  isLoading?: boolean
}

export function StudentForm({ onSubmit, onCancel, defaultValues, isLoading }: StudentFormProps) {
  const [values, setValues] = useState<StudentFormValues>({
    name: defaultValues?.name || "",
    parent_name: defaultValues?.parent_name || "",
    parent_phone: defaultValues?.parent_phone || "",
    contact_preference: defaultValues?.contact_preference || "",
    address: defaultValues?.address || "",
    remarks: defaultValues?.remarks || "",
  })

  function set<K extends keyof StudentFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.name.trim()) return
    await onSubmit({
      name: values.name.trim(),
      parent_name: values.parent_name.trim(),
      parent_phone: values.parent_phone.trim(),
      contact_preference: values.contact_preference.trim(),
      address: values.address.trim(),
      remarks: values.remarks.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tm-student-name">Student name *</Label>
          <Input id="tm-student-name" value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Zhao Bin" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-parent-name">Parent name</Label>
          <Input id="tm-parent-name" value={values.parent_name} onChange={(e) => set("parent_name", e.target.value)} placeholder="e.g. Li Shiwei" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-parent-phone">Parent phone</Label>
          <Input id="tm-parent-phone" type="tel" value={values.parent_phone} onChange={(e) => set("parent_phone", e.target.value)} placeholder="e.g. 9123 4567" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-contact-pref">Contact preference</Label>
          <Input id="tm-contact-pref" value={values.contact_preference} onChange={(e) => set("contact_preference", e.target.value)} placeholder="e.g. WeChat" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-address">Address</Label>
          <Input id="tm-address" value={values.address} onChange={(e) => set("address", e.target.value)} placeholder="Blk, street, unit" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tm-student-remarks">Remarks</Label>
          <Textarea id="tm-student-remarks" rows={2} value={values.remarks} onChange={(e) => set("remarks", e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading || !values.name.trim()}>{isLoading ? "Saving..." : "Save"}</Button>
      </DialogFooter>
    </form>
  )
}
