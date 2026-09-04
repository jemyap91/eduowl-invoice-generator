"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StudentList } from "@/components/students/student-list"
import { ParentList } from "@/components/students/parent-list"

export default function StudentsPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="students" className="space-y-4">
        <TabsList>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="parents">Parents</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <StudentList />
        </TabsContent>

        <TabsContent value="parents">
          <ParentList />
        </TabsContent>
      </Tabs>
    </div>
  )
}
