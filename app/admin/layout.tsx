"use client"

import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AuthProvider, useAuth } from "@/lib/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { Spinner } from "@/components/ui/spinner"
import { Toaster } from "@/components/ui/sonner"
import { NotificationBell } from "@/components/admin/notification-bell"
import { isSupabaseConfigured } from "@/lib/supabase"
import { cn } from "@/lib/utils"

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
        <header className="h-16 border-b border-border flex items-center justify-between px-6 md:px-8 bg-card/50 backdrop-blur-sm z-10 shrink-0">
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider",
              isSupabaseConfigured() 
                ? "bg-green-500/10 text-green-600 border border-green-500/20" 
                : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
            )}>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                isSupabaseConfigured() ? "bg-green-500" : "bg-amber-500"
              )} />
              {isSupabaseConfigured() ? "System Live" : "Local / Mock Mode"}
            </div>
            {!isSupabaseConfigured() && (
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                Check .env.local for Supabase keys
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
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
