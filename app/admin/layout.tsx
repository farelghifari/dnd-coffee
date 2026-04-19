"use client"

import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AuthProvider, useAuth } from "@/lib/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { Spinner } from "@/components/ui/spinner"
import { Toaster } from "@/components/ui/sonner"
import { NotificationBell } from "@/components/admin/notification-bell"

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading, canAccessAdmin, isSuperAdmin } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Not logged in or not an admin/super_admin - redirect to login
    if (!isLoading && (!user || !canAccessAdmin())) {
      router.push("/login")
      return
    }
    
    // Protect /admin/settings - only super_admin can access
    if (!isLoading && pathname === "/admin/settings" && !isSuperAdmin()) {
      router.push("/admin")
      return
    }
  }, [user, isLoading, router, pathname, canAccessAdmin, isSuperAdmin])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  // Not authorized
  if (!user || !canAccessAdmin()) {
    return null
  }
  
  // Trying to access settings without super_admin role
  if (pathname === "/admin/settings" && !isSuperAdmin()) {
    return null
  }

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border flex items-center justify-end px-6 md:px-8 bg-card/50 backdrop-blur-sm z-10 shrink-0">
          <NotificationBell />
        </header>
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AuthProvider>
  )
}
