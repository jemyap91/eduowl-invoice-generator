"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SubjectsSettings } from "@/components/settings/subjects-settings"
import { StreamsSettings } from "@/components/settings/streams-settings"
import { ClassroomsSettings } from "@/components/settings/classrooms-settings"
import { ClassTypesSettings } from "@/components/settings/class-types-settings"
import { PaymentMethodsSettings } from "@/components/settings/payment-methods-settings"
import { AcademyInfoSettings } from "@/components/settings/academy-info-settings"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="subjects" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="streams">Streams</TabsTrigger>
          <TabsTrigger value="classrooms">Classrooms</TabsTrigger>
          <TabsTrigger value="class-types">Class Types & Rates</TabsTrigger>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="academy-info">Academy Info</TabsTrigger>
        </TabsList>

        <TabsContent value="subjects">
          <SubjectsSettings />
        </TabsContent>

        <TabsContent value="streams">
          <StreamsSettings />
        </TabsContent>

        <TabsContent value="classrooms">
          <ClassroomsSettings />
        </TabsContent>

        <TabsContent value="class-types">
          <ClassTypesSettings />
        </TabsContent>

        <TabsContent value="payment-methods">
          <PaymentMethodsSettings />
        </TabsContent>

        <TabsContent value="academy-info">
          <AcademyInfoSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}
