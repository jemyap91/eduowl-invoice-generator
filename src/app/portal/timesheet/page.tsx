"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { TimesheetMonth } from "@/components/portal/timesheet-month"
import { currentPeriod, parseMonthInput, toMonthInput, type Period } from "@/lib/tm/periods"

function Timesheet() {
  const params = useSearchParams()
  const router = useRouter()
  const [period, setPeriod] = useState<Period>(() => parseMonthInput(params.get("month") ?? "") ?? currentPeriod())

  function change(p: Period) {
    setPeriod(p)
    router.replace(`/portal/timesheet?month=${toMonthInput(p)}`)
  }

  return <TimesheetMonth period={period} onPeriodChange={change} />
}

export default function MyTimesheetPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">My Timesheet</h1>
      <Suspense>
        <Timesheet />
      </Suspense>
    </div>
  )
}
