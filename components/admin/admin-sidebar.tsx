"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  ClipboardList,
  TrendingUp,
  LogOut,
  CalendarDays,
  Clock,
  Crown,
  ShieldCheck,
  Layers,
  FileText
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Badge } from "@/components/ui/badge"

// Nav items - Settings is only visible to main_super_admin
const baseNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/inventory", label: "Inventory", icon: Package },
  { href: "/admin/batches", label: "Batch Tracking", icon: Layers },
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/admin/scheduling", label: "Scheduling", icon: CalendarDays },
  { href: "/admin/overtime", label: "Overtime", icon: Clock },
  { href: "/admin/report", label: "Report", icon: FileText },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/forecasting", label: "Forecasting", icon: TrendingUp },
  { href: "/admin/logs", label: "Logs", icon: ClipboardList },
]

// Settings menu item - only for main_super_admin (not temporary super_admin)
const settingsNavItem = { href: "/admin/settings", label: "Settings", icon: Settings }

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, isSuperAdmin, isMainSuperAdmin, user, getRoleDisplayLabel } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  
  // Build nav items based on role
  // Settings is ONLY visible to main_super_admin (not temporary super_admin or admin)
  const navItems = isMainSuperAdmin() 
    ? [...baseNavItems, settingsNavItem] 
    : baseNavItems

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  // Get role icon
  const getRoleIcon = () => {
    if (isMainSuperAdmin()) return <Crown className="w-3 h-3" />
    if (isSuperAdmin()) return <Crown className="w-3 h-3" />
    return <ShieldCheck className="w-3 h-3" />
  }

  // Get role badge style with colored borders
  // admin = gray border, super_admin = yellow border, main_super_admin = purple border
  const getRoleBadgeStyle = () => {
    if (isMainSuperAdmin()) return "bg-purple-100 text-purple-800 border-2 border-purple-500 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-400"
    if (isSuperAdmin()) return "bg-amber-100 text-amber-800 border-2 border-yellow-500 dark:bg-amber-900/30 dark:text-amber-300 dark:border-yellow-400"
    return "bg-gray-100 text-gray-800 border-2 border-gray-400 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-500"
  }

  return (
    <aside 
      className={cn(
        "bg-card border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        {!collapsed && (
          <Link href="/admin" className="font-semibold text-sm tracking-wider">
            DONOTDISTURB
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-md hover:bg-muted transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Account Status Display - Shows: full name on top line, role badge with colored border below */}
      {!collapsed && user && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              isMainSuperAdmin() ? "bg-purple-100 dark:bg-purple-900/30" :
              isSuperAdmin() ? "bg-amber-100 dark:bg-amber-900/30" :
              "bg-gray-100 dark:bg-gray-800"
            )}>
              {isMainSuperAdmin() || isSuperAdmin() ? (
                <Crown className={cn(
                  "w-4 h-4",
                  isMainSuperAdmin() ? "text-purple-600 dark:text-purple-400" : "text-amber-600 dark:text-amber-400"
                )} />
              ) : (
                <ShieldCheck className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user.name}
              </p>
              <Badge variant="outline" className={cn("mt-1 text-xs", getRoleBadgeStyle())}>
                {getRoleIcon()}
                <span className="ml-1">{getRoleDisplayLabel()}</span>
              </Badge>
            </div>
          </div>
        </div>
      )}
      {collapsed && user && (
        <div className="p-2 border-b border-border flex justify-center">
          <div 
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center border-2",
              isMainSuperAdmin() ? "bg-purple-100 border-purple-500 dark:bg-purple-900/30 dark:border-purple-400" :
              isSuperAdmin() ? "bg-amber-100 border-yellow-500 dark:bg-amber-900/30 dark:border-yellow-400" :
              "bg-gray-100 border-gray-400 dark:bg-gray-800 dark:border-gray-500"
            )}
            title={`${user.nickname || user.name} - ${getRoleDisplayLabel()}`}
          >
            {isMainSuperAdmin() ? (
              <Crown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            ) : isSuperAdmin() ? (
              <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/admin" && pathname.startsWith(item.href))
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-sm transition-colors",
                    isActive 
                      ? "bg-foreground text-background" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="text-sm">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer Actions */}
      <div className="p-2 border-t border-border space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={collapsed ? "Back to Website" : undefined}
        >
          <ChevronLeft className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-sm">Back to Website</span>}
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  )
}
