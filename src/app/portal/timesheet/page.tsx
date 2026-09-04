import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function MyTimesheetPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Timesheet</CardTitle>
        <CardDescription>Review and submit this month&apos;s sessions.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Nothing to show yet.</CardContent>
    </Card>
  )
}
