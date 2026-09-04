import { StatsCards } from "@/components/dashboard/stats-cards"
import { TodaysClasses } from "@/components/dashboard/todays-classes"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RevenueSummary } from "@/components/dashboard/revenue-summary"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TodaysClasses />
        <QuickActions />
      </div>

      <RevenueSummary />
    </div>
  )
}
