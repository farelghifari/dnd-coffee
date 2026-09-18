"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { authenticateUser, getEmployeeById } from "./api/supabase-service"

// Role hierarchy: main_super_admin > super_admin > admin > employee
type UserRole = "super_admin" | "admin" | "employee"

interface User {
  id: string
  email: string
  role: UserRole
  employeeId?: string
  name?: string
  nickname?: string
  isMainSuperAdmin?: boolean // Flag for the permanent main super admin
  dbRole?: string // Store the original database role
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  isLoading: boolean
  isSuperAdmin: () => boolean
  isMainSuperAdmin: () => boolean
  isAdmin: () => boolean
  canAccessAdmin: () => boolean
  getRoleDisplayLabel: () => string
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Main super admin email - this user has permanent full access
export const MAIN_SUPER_ADMIN_EMAIL = "farellelghifari@gmail.com"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Refresh user data from database
  const refreshUser = async () => {
    if (!user?.employeeId) return
    
    try {
      const employee = await getEmployeeById(user.employeeId)
      if (employee) {
        const isMain = (employee.email || "").toLowerCase() === MAIN_SUPER_ADMIN_EMAIL.toLowerCase()
        
        // Determine effective role
        let effectiveRole: UserRole = "employee"
        if (isMain) {
          effectiveRole = "super_admin"
        } else if (employee.role === "super_admin") {
          // Check if temporary super_admin has expired
          if (employee.super_admin_expires_at) {
            // IMPORTANT: Use ISO string comparison for consistency
            const now = new Date().toISOString()
            const expiresAt = employee.super_admin_expires_at
            
            if (expiresAt < now) {
              effectiveRole = "admin" // Expired, treat as admin
            } else {
              effectiveRole = "super_admin"
            }
          } else {
            effectiveRole = "super_admin"
          }
        } else if (employee.role === "admin") {
          effectiveRole = "admin"
        }
        
        const updatedUser: User = {
          ...user,
          role: effectiveRole,
          name: employee.name,
          nickname: employee.nickname || employee.name,
          isMainSuperAdmin: isMain,
          dbRole: employee.role
        }
        
        setUser(updatedUser)
        localStorage.setItem("dnd_user", JSON.stringify(updatedUser))
      }
    } catch (error) {
      console.error("[v0] Error refreshing user:", error)
    }
  }

  useEffect(() => {
    // Check for existing session
    const storedUser = localStorage.getItem("dnd_user")
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setUser(parsed)
      } catch {
        localStorage.removeItem("dnd_user")
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Authenticate against Supabase employees table
      const employee = await authenticateUser(email, password)
      
      if (employee) {
        // Check if user is active
        if (employee.status !== "active") {
          return { success: false, error: "Access disabled. Please contact an administrator." }
        }
        
        const isMain = (employee.email || "").toLowerCase() === MAIN_SUPER_ADMIN_EMAIL.toLowerCase()
        
        // Determine role based on email and database role
        let role: UserRole = "employee"
        
        if (isMain) {
          // Main super admin - permanent full access
          role = "super_admin"
        } else if (employee.role === "super_admin") {
          // Check if temporary super_admin has expired
          if (employee.super_admin_expires_at) {
            // IMPORTANT: Use ISO string comparison or Date object consistently
            const now = new Date().toISOString()
            const expiresAt = employee.super_admin_expires_at
            
            console.log("AUTH CHECK - NOW:", now)
            console.log("AUTH CHECK - EXPIRES:", expiresAt)
            console.log("AUTH CHECK - COMPARISON:", expiresAt < now ? "EXPIRED" : "VALID")
            
            if (expiresAt < now) {
              role = "admin" // Expired, treat as admin
            } else {
              role = "super_admin"
            }
          } else {
            role = "super_admin"
          }
        } else if (employee.role === "admin") {
          role = "admin"
        }
        // Otherwise stays as "employee"
        
        const userData: User = {
          id: employee.id,
          email: employee.email,
          role: role,
          employeeId: employee.id,
          name: employee.name,
          nickname: employee.nickname || employee.name,
          isMainSuperAdmin: isMain,
          dbRole: employee.role
        }
        
        setUser(userData)
        localStorage.setItem("dnd_user", JSON.stringify(userData))
        return { success: true }
      }
      
      return { success: false, error: "Invalid email or password" }
    } catch (error) {
      console.error("Login error:", error)
      return { success: false, error: "An error occurred during login" }
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("dnd_user")
    localStorage.removeItem("dnd_ops_session")
  }

  // Helper functions for role checking
  const isSuperAdmin = () => user?.role === "super_admin"
  const isMainSuperAdmin = () => user?.isMainSuperAdmin === true
  const isAdmin = () => user?.role === "admin" || user?.role === "super_admin"
  const canAccessAdmin = () => user?.role === "admin" || user?.role === "super_admin"
  
  // Get display label for role
  const getRoleDisplayLabel = (): string => {
    if (user?.isMainSuperAdmin) {
      return "Main Super Admin"
    }
    if (user?.role === "super_admin") {
      return "Super Admin"
    }
    if (user?.role === "admin") {
      return "Admin"
    }
    return "Employee"
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isLoading, 
      isSuperAdmin, 
      isMainSuperAdmin,
      isAdmin, 
      canAccessAdmin,
      getRoleDisplayLabel,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
