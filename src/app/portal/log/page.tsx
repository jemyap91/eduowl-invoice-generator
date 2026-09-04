import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LogSessionPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Log a Session</CardTitle>
        <CardDescription>Record a tutoring session against one of your assignments.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Nothing to show yet.</CardContent>
    </Card>
  )
}
