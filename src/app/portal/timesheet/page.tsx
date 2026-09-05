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
    <Suspense>
      <Timesheet />
    </Suspense>
  )
}
