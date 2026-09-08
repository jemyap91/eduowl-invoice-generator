import { createClient } from "@/lib/supabase/client"
import type { TmSettings } from "@/lib/tm/types"
import { mapInvoiceEntry, type InvoiceEntry, type InvoiceRow, type RawInvoiceEntryRow } from "@/lib/tm/invoices"

/** Entries billed on a generated invoice, oldest first. Manual invoices have none. */
export async function loadInvoiceEntries(row: InvoiceRow): Promise<InvoiceEntry[]> {
  if (row.source !== "generated") return []
  const supabase = createClient()
  const { data, error } = await supabase
    .from("tm_timesheet_entries")
    .select("id, date, start_time, end_time, hours, tier_label, parent_rate, tutor_rate, note")
    .eq("invoice_id", row.id)
    .order("date")
    .order("start_time", { nullsFirst: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as RawInvoiceEntryRow[]).map(mapInvoiceEntry)
}

/** Everything WhatsApp text and the PDF need beyond the row itself. */
export async function loadInvoiceContext(row: InvoiceRow): Promise<{ settings: TmSettings; entries: InvoiceEntry[] }> {
  const supabase = createClient()
  const [settingsRes, entries] = await Promise.all([
    supabase.from("tm_settings").select("*").limit(1).maybeSingle(),
    loadInvoiceEntries(row),
  ])
  if (settingsRes.error) throw new Error(settingsRes.error.message)
  if (!settingsRes.data) throw new Error("Tutor Matching settings are missing")
  return { settings: settingsRes.data as TmSettings, entries }
}
