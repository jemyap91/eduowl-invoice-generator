import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function MyStudentsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Students</CardTitle>
        <CardDescription>Your active assignments will appear here.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Nothing to show yet.</CardContent>
    </Card>
  )
}
