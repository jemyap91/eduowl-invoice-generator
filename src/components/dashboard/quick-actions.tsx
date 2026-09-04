"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarPlus, FileText, UserPlus } from "lucide-react"

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" className="w-full justify-start gap-2" asChild>
          <Link href="/schedule">
            <CalendarPlus className="h-4 w-4" />
            New Class
          </Link>
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2" asChild>
          <Link href="/invoices">
            <FileText className="h-4 w-4" />
            Generate Invoice
          </Link>
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2" asChild>
          <Link href="/students">
            <UserPlus className="h-4 w-4" />
            Add Student
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
