"use client"

import { useState } from "react"
import { PendingSignups } from "@/components/tm/pending-signups"
import { TutorList } from "@/components/tm/tutor-list"

export default function TmTutorsPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <div className="space-y-6">
      <PendingSignups onChanged={() => setRefreshKey((k) => k + 1)} />
      <TutorList refreshKey={refreshKey} />
    </div>
  )
}
