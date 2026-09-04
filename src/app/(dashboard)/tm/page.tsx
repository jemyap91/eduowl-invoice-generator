import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function TutorMatchingDashboardPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tutor Matching</CardTitle>
          <CardDescription>
            Home tutoring timesheets, approvals, and invoicing.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Manage tutors, students and assignments from the menu. Approvals, invoices and this dashboard arrive in the next slices.
        </CardContent>
      </Card>
    </div>
  )
}
