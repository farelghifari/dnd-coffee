"use client"

import { AuthProvider, useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Spinner } from "@/components/ui/spinner"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { LogOut, Coffee, User } from "lucide-react"
import Link from "next/link"

function EmployeeLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
    // NO automatic redirect for admins - all users stay on /employee
    // Admin/super_admin can manually click "View Dashboard" button to access /admin
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  // Allow ALL authenticated users to view employee page
  // Admin/super_admin can manually navigate to /admin via "View Dashboard" button
  if (!user) {
    return null
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/employee" className="flex items-center gap-2">
            <Coffee className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">DONOTDISTURB</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{user.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
      <Toaster />
    </div>
  )
}

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <EmployeeLayoutContent>{children}</EmployeeLayoutContent>
    </AuthProvider>
  )
}
