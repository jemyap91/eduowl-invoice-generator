"use client"

import { ClassSeriesList } from "@/components/schedule/class-series-list"
import { CalendarView } from "@/components/schedule/calendar-view"
import { AllClassesList } from "@/components/schedule/all-classes-list"
import { BootcampList } from "@/components/schedule/bootcamp-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarDays, List, TableProperties, GraduationCap } from "lucide-react"

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="all-classes" className="gap-1.5">
            <TableProperties className="h-4 w-4" />
            All Classes
          </TabsTrigger>
          <TabsTrigger value="series" className="gap-1.5">
            <List className="h-4 w-4" />
            Class Series
          </TabsTrigger>
          <TabsTrigger value="bootcamps" className="gap-1.5">
            <GraduationCap className="h-4 w-4" />
            Bootcamps
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <CalendarView />
        </TabsContent>

        <TabsContent value="all-classes">
          <AllClassesList />
        </TabsContent>

        <TabsContent value="series">
          <ClassSeriesList />
        </TabsContent>

        <TabsContent value="bootcamps">
          <BootcampList />
        </TabsContent>
      </Tabs>
    </div>
  )
}
