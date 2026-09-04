"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { GraduationCap, Users, Calendar, DollarSign } from "lucide-react"

interface Stats {
  totalStudents: number
  totalTutors: number
  classesToday: number
  revenueThisMonth: number
}

export function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const supabase = createClient()

        const today = new Date().toISOString().split("T")[0]
        const currentMonth = new Date().getMonth() + 1
        const currentYear = new Date().getFullYear()

        const [studentsRes, tutorsRes, sessionsRes, invoicesRes] =
          await Promise.all([
            supabase.from("students").select("id", { count: "exact", head: true }),
            supabase.from("tutors").select("id", { count: "exact", head: true }),
            supabase
              .from("class_sessions")
              .select("id", { count: "exact", head: true })
              .eq("date", today),
            supabase
              .from("invoices")
              .select("subtotal")
              .eq("month", currentMonth)
              .eq("year", currentYear)
              .neq("status", "draft"),
          ])

        const revenue =
          invoicesRes.data?.reduce(
            (sum, inv) => sum + (Number(inv.subtotal) || 0),
            0
          ) ?? 0

        setStats({
          totalStudents: studentsRes.count ?? 0,
          totalTutors: tutorsRes.count ?? 0,
          classesToday: sessionsRes.count ?? 0,
          revenueThisMonth: revenue,
        })
      } catch (error) {
        console.error("Failed to fetch stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const cards = [
    {
      title: "Total Students",
      value: stats?.totalStudents ?? 0,
      icon: GraduationCap,
      format: (v: number) => v.toString(),
    },
    {
      title: "Total Tutors",
      value: stats?.totalTutors ?? 0,
      icon: Users,
      format: (v: number) => v.toString(),
    },
    {
      title: "Classes Today",
      value: stats?.classesToday ?? 0,
      icon: Calendar,
      format: (v: number) => v.toString(),
    },
    {
      title: "Revenue This Month",
      value: stats?.revenueThisMonth ?? 0,
      icon: DollarSign,
      format: (v: number) =>
        `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {card.title}
            </CardTitle>
            <card.icon className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                {card.format(card.value)}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
