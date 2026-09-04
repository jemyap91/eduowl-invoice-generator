import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SignOutButton } from "@/components/auth/sign-out-button"

export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <Image src="/tm/logo.png" alt="EduOwl" width={96} height={96} priority />
          </div>
          <div>
            <CardTitle className="text-xl">Thanks for signing up</CardTitle>
            <CardDescription className="mt-2">
              EduOwl will approve your account shortly. Once approved, sign in again to reach your tutor portal.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  )
}
