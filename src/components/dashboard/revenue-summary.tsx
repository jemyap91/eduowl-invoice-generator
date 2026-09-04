"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DollarSign } from "lucide-react"

interface MonthRevenue {
  label: string
  amount: number
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

export function RevenueSummary() {
  const [months, setMonths] = useState<MonthRevenue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRevenue() {
      try {
        const supabase = createClient()
        const now = new Date()

        // Build last 6 months
        const monthPairs: { month: number; year: number; label: string }[] = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          monthPairs.push({
            month: d.getMonth() + 1,
            year: d.getFullYear(),
            label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
          })
        }

        // Fetch all invoices in the date range (not draft)
        const earliest = monthPairs[0]
        const latest = monthPairs[monthPairs.length - 1]

        const { data } = await supabase
          .from("invoices")
          .select("month, year, subtotal")
          .neq("status", "draft")
          .gte("year", earliest.year)
          .lte("year", latest.year)

        const invoices = data ?? []

        const result: MonthRevenue[] = monthPairs.map((mp) => {
          const amount = invoices
            .filter((inv) => inv.month === mp.month && inv.year === mp.year)
            .reduce((sum, inv) => sum + (Number(inv.subtotal) || 0), 0)
          return { label: mp.label, amount }
        })

        // Only show months with revenue > 0, but always include current month
        const currentMonth = monthPairs[monthPairs.length - 1]
        const filtered = result.filter(
          (m) => m.amount > 0 || m.label === currentMonth.label
        )
        setMonths(filtered)
      } catch (error) {
        console.error("Failed to fetch revenue:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRevenue()
  }, [])

  const maxAmount = Math.max(...months.map((m) => m.amount), 1)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <DollarSign className="h-5 w-5 text-primary" />
        <CardTitle>Revenue Summary (Last 6 Months)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : months.every((m) => m.amount === 0) ? (
          <p className="text-center text-muted-foreground py-8">No revenue data yet</p>
        ) : (
          <div className="space-y-3">
            {months.map((m) => (
              <div key={m.label} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-24 shrink-0">
                  {m.label}
                </span>
                <div className="flex-1 h-8 bg-muted rounded-md overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-md transition-all duration-500"
                    style={{
                      width: `${m.amount > 0 ? (m.amount / maxAmount) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium w-24 text-right">
                  ${m.amount.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
