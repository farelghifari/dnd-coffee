"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { 
  getEmployees, 
  updateEmployee, 
  promoteSuperAdmin,
  getShiftConfigs,
  updateShiftConfig,
  addShiftConfig,
  deleteShiftConfig,
  type Employee,
  type ShiftConfig 
} from "@/lib/api/supabase-service"
import { shopInfo } from "@/lib/data"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  Store, 
  Clock, 
  Bell,
  Shield,
  Users,
  Check,
  Crown,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  User,
  CalendarClock,
  Timer,
  XCircle
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

// Fixed shift slot types
interface FixedShiftSlot {
  id: string
  label: string
  start_time: string
  end_time: string
  type: "full-time" | "part-time"
}

// Duration options in minutes
const DURATION_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "120", label: "2 hours" },
  { value: "240", label: "4 hours" },
  { value: "480", label: "8 hours" },
  { value: "1440", label: "1 day" },
  { value: "10080", label: "1 week" },
]

export default function SettingsPage() {
  const { isMainSuperAdmin, user } = useAuth()
  const router = useRouter()
  
  // Extra protection - redirect if not main_super_admin
  // Only the main super admin can access Settings
  useEffect(() => {
    if (!isMainSuperAdmin()) {
      router.push("/admin")
    }
  }, [isMainSuperAdmin, router])

  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [roleChangeConfirmOpen, setRoleChangeConfirmOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [targetRole, setTargetRole] = useState<string>("")
  const [durationMinutes, setDurationMinutes] = useState<string>("60")
  
  // Countdown timers state - store remaining seconds for each temporary super_admin
  const [countdowns, setCountdowns] = useState<Record<string, number>>({})
  
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  
  // Fixed shift configuration state - predefined slots
  const [fullTimeShifts, setFullTimeShifts] = useState<FixedShiftSlot[]>([
    { id: "ft-1", label: "Full-time Shift 1", start_time: "06:00", end_time: "14:00", type: "full-time" },
    { id: "ft-2", label: "Full-time Shift 2", start_time: "14:00", end_time: "22:00", type: "full-time" }
  ])
  
  const [partTimeShifts, setPartTimeShifts] = useState<FixedShiftSlot[]>([
    { id: "pt-1", label: "Part-time Shift 1", start_time: "06:00", end_time: "10:00", type: "part-time" },
    { id: "pt-2", label: "Part-time Shift 2", start_time: "10:00", end_time: "14:00", type: "part-time" },
    { id: "pt-3", label: "Part-time Shift 3", start_time: "14:00", end_time: "18:00", type: "part-time" }
  ])

  // Dynamic counts state
  const [ftCount, setFtCount] = useState(2)
  const [ptCount, setPtCount] = useState(3)
  
  // Store the database shift configs to track IDs
  const [dbShiftConfigs, setDbShiftConfigs] = useState<ShiftConfig[]>([])

  // Super admin email constant - this user cannot be demoted or edited
  const MAIN_SUPER_ADMIN_EMAIL = "farellelghifari@gmail.com"

  // Check for expired temporary super_admins and demote them
  const checkAndDemoteExpired = useCallback(async (employeesList: Employee[]) => {
    // IMPORTANT: Use ISO string comparison for consistency
    const now = new Date().toISOString()
    let needsRefresh = false
    
    for (const emp of employeesList) {
      if (emp.role === 'super_admin' && emp.super_admin_expires_at) {
        const expiresAt = emp.super_admin_expires_at
        
        // String comparison works for ISO dates (lexicographic order matches chronological)
        if (expiresAt < now && (emp.email || "").toLowerCase() !== MAIN_SUPER_ADMIN_EMAIL.toLowerCase()) {
          // Auto-demote expired temporary super_admin to admin
          console.log("AUTO-DEMOTE ID:", emp.id)
          console.log("AUTO-DEMOTE NAME:", emp.name)
          
          const result = await updateEmployee(emp.id, { role: 'admin', super_admin_expires_at: null })
          
          console.log("AUTO-DEMOTE RESULT:", result)
          
          if (result && result.role === 'admin') {
            needsRefresh = true
            toast.info(`${emp.name}'s temporary super admin access has expired`)
          } else {
            toast.error(`Failed to auto-demote ${emp.name}`)
          }
        }
      }
    }
    
    return needsRefresh
  }, [])

  // Fetch all employees from Supabase
  const fetchEmployees = useCallback(async () => {
    setIsLoading(true)
    const data = await getEmployees()
    
    // Check for expired temporary super_admins
    const needsRefresh = await checkAndDemoteExpired(data)
    
    if (needsRefresh) {
      // Refetch after potential demotions
      const refreshedData = await getEmployees()
      setEmployees(refreshedData)
      updateCountdowns(refreshedData)
    } else {
      setEmployees(data)
      updateCountdowns(data)
    }
    
    setIsLoading(false)
  }, [checkAndDemoteExpired])

  // Update countdown timers based on employees data
  const updateCountdowns = (employeesList: Employee[]) => {
    const now = Date.now()
    const newCountdowns: Record<string, number> = {}
    
    for (const emp of employeesList) {
      if (emp.role === 'super_admin' && emp.super_admin_expires_at && (emp.email || "").toLowerCase() !== MAIN_SUPER_ADMIN_EMAIL.toLowerCase()) {
        const expiresAt = new Date(emp.super_admin_expires_at).getTime()
        const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000))
        newCountdowns[emp.id] = remainingSeconds
      }
    }
    
    setCountdowns(newCountdowns)
  }

  // Countdown timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdowns(prev => {
        const updated = { ...prev }
        let hasExpired = false
        
        for (const id of Object.keys(updated)) {
          if (updated[id] > 0) {
            updated[id] -= 1
          } else {
            hasExpired = true
          }
        }
        
        // If any timer expired, refetch employees
        if (hasExpired) {
          fetchEmployees()
        }
        
        return updated
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [fetchEmployees])

  // Fetch shift configurations and map to fixed slots
  const fetchShiftConfigs = async () => {
    console.log("[v0] Fetching shift configurations...")
    const data = await getShiftConfigs()
    console.log("[v0] Shift configs from DB:", data)
    setDbShiftConfigs(data)
    
    // Determine dynamic counts based on DB data
    const ftFromDb = data.filter(c => c.name.startsWith("Full-time Shift")).length
    const ptFromDb = data.filter(c => c.name.startsWith("Part-time Shift")).length
    
    if (ftFromDb > 0) setFtCount(ftFromDb)
    if (ptFromDb > 0) setPtCount(ptFromDb)

    // Build the shift slot arrays based on current counts
    const finalFtShifts = Array.from({ length: Math.max(ftFromDb, ftCount) }).map((_, i) => {
      const configName = `Full-time Shift ${i + 1}`
      const existing = data.find(c => c.name === configName)
      return {
        id: existing?.id || `ft-${i + 1}`,
        label: configName,
        start_time: existing?.start_time || "06:00",
        end_time: existing?.end_time || "14:00",
        type: "full-time" as const
      }
    })
    setFullTimeShifts(finalFtShifts)

    const finalPtShifts = Array.from({ length: Math.max(ptFromDb, ptCount) }).map((_, i) => {
      const configName = `Part-time Shift ${i + 1}`
      const existing = data.find(c => c.name === configName)
      return {
        id: existing?.id || `pt-${i + 1}`,
        label: configName,
        start_time: existing?.start_time || "06:00",
        end_time: existing?.end_time || "10:00",
        type: "part-time" as const
      }
    })
    setPartTimeShifts(finalPtShifts)
  }

  useEffect(() => {
    fetchEmployees()
    fetchShiftConfigs()
  }, [fetchEmployees])

  // Check if an employee record is the main super admin (by email)
  const isEmployeeMainSuperAdmin = (employee: Employee) => {
    return (employee.email || "").toLowerCase() === MAIN_SUPER_ADMIN_EMAIL.toLowerCase()
  }

  // Format countdown time as HH:mm:ss
  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return "00:00:00"
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Get allowed role changes based on current role
  const getAllowedRoleChanges = (employee: Employee): { role: string; label: string; isPromotion: boolean }[] => {
    if (isEmployeeMainSuperAdmin(employee)) {
      return [] // Cannot change main super admin
    }

    const currentRole = employee.role || 'employee'
    
    switch (currentRole) {
      case 'employee':
        // Employee can only be promoted to admin
        return [{ role: 'admin', label: 'Promote to Admin', isPromotion: true }]
      case 'admin':
        // Admin can be promoted to super_admin (temporary) or demoted to employee
        return [
          { role: 'super_admin', label: 'Promote to Super Admin', isPromotion: true },
          { role: 'employee', label: 'Demote to Employee', isPromotion: false }
        ]
      case 'super_admin':
        // Super admin can only be demoted to admin (not employee)
        return [{ role: 'admin', label: 'Demote to Admin', isPromotion: false }]
      default:
        return [{ role: 'admin', label: 'Promote to Admin', isPromotion: true }]
    }
  }

  // Handle role change with validation
  // IMPORTANT: For super_admin promotion, we delegate time calculation to the database
  // Do NOT use new Date() or toISOString() for expiration - send only duration_minutes
  const handleRoleChange = async () => {
    if (!selectedEmployee || !targetRole) {
      toast.error("Missing employee or target role")
      return
    }

    // MANDATORY DEBUG - Log all values
    const selected_user_id = selectedEmployee.id
    const new_role = targetRole
    console.log("UPDATE ID:", selected_user_id)
    console.log("NEW ROLE:", new_role)
    console.log("CURRENT ROLE:", selectedEmployee.role)

    // Validate: cannot modify main super admin
    if (isEmployeeMainSuperAdmin(selectedEmployee)) {
      toast.error("Cannot modify the main super admin")
      return
    }

    // Validate: super_admin promotion requires duration
    if (new_role === 'super_admin' && !durationMinutes) {
      toast.error("Please select a duration for temporary super admin access")
      return
    }

    // Validate: super_admin can only be demoted to admin
    if (selectedEmployee.role === 'super_admin' && new_role === 'employee') {
      toast.error("Super admin can only be demoted to admin, not directly to employee")
      return
    }

    try {
      let result: Employee | null = null
      
      if (new_role === 'super_admin') {
        // IMPORTANT: Use promoteSuperAdmin which delegates time calculation to database
        // Do NOT calculate expiration time in frontend - timezone issues
        const duration = Number(durationMinutes)
        if (isNaN(duration) || duration <= 0) {
          toast.error("Invalid duration. Please select a valid time period.")
          return
        }
        
        console.log("PROMOTING TO SUPER ADMIN")
        console.log("DURATION MINUTES:", duration)
        // Only send duration_minutes - database will calculate: now() + interval
        result = await promoteSuperAdmin(selected_user_id, duration)
      } else {
        // For demotion or other role changes, use updateEmployee
        // Clear super_admin_expires_at when demoting
        result = await updateEmployee(selected_user_id, {
          role: new_role as Employee['role'],
          super_admin_expires_at: null
        })
      }
      
      console.log("RESULT:", result)

      if (result) {
        // VERIFY SAVE - Check role was actually updated
        if (result.role !== new_role) {
          toast.error(`Role update failed! Expected: ${new_role}, Got: ${result.role}`)
          return
        }
        
        // REFETCH DATA - Immediately refetch employees
        await fetchEmployees()
        
        setRoleChangeConfirmOpen(false)
        setSelectedEmployee(null)
        setTargetRole("")
        setDurationMinutes("60")
        
        const roleLabel = new_role === 'admin' ? 'an Admin' : 
                          new_role === 'super_admin' ? 'a Temporary Super Admin' : 
                          'an Employee'
        toast.success(`${selectedEmployee.name} is now ${roleLabel}`)
      } else {
        // ERROR HANDLING - Display error visibly, no silent failure
        toast.error("Failed to update role. Database update returned null. Check console for Supabase errors.")
      }
    } catch (error) {
      // ERROR HANDLING - Display error visibly
      console.log("ERROR:", error)
      toast.error(`Role update error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Cancel/revoke temporary super admin immediately
  const handleCancelSuperAdmin = async (employee: Employee) => {
    if (isEmployeeMainSuperAdmin(employee)) return
    
    console.log("CANCEL SUPER ADMIN - ID:", employee.id)
    
    const result = await updateEmployee(employee.id, { 
      role: 'admin', 
      super_admin_expires_at: null 
    })
    
    console.log("CANCEL RESULT:", result)
    
    if (result) {
      // VERIFY SAVE
      if (result.role !== 'admin') {
        toast.error(`Demotion failed! Expected: admin, Got: ${result.role}`)
        return
      }
      // REFETCH DATA
      await fetchEmployees()
      toast.success(`${employee.name} has been demoted to Admin`)
    } else {
      toast.error("Failed to revoke super admin access. Check console for errors.")
    }
  }

  const initiateRoleChange = (employee: Employee, newRole: string) => {
    setSelectedEmployee(employee)
    setTargetRole(newRole)
    setDurationMinutes("60")
    setRoleChangeConfirmOpen(true)
  }

  const getRoleBadge = (employee: Employee) => {
    const role = employee.role || 'employee'
    const isTemporary = role === 'super_admin' && employee.super_admin_expires_at && !isEmployeeMainSuperAdmin(employee)
    const countdown = countdowns[employee.id]
    
    switch (role) {
      case 'super_admin':
        return (
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
              <Crown className="w-3 h-3 mr-1" />
              Super Admin
            </Badge>
            {isTemporary && countdown !== undefined && (
              <Badge variant="outline" className="text-xs font-mono bg-amber-50 animate-pulse">
                <Timer className="w-3 h-3 mr-1" />
                {formatCountdown(countdown)}
              </Badge>
            )}
            {isEmployeeMainSuperAdmin(employee) && (
              <Badge variant="outline" className="text-xs bg-amber-50">
                Main
              </Badge>
            )}
          </div>
        )
      case 'admin':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><ShieldCheck className="w-3 h-3 mr-1" />Admin</Badge>
      default:
        return <Badge variant="secondary"><User className="w-3 h-3 mr-1" />Employee</Badge>
    }
  }

  const handleSave = (section: string) => {
    setSaveSuccess(section)
    toast.success(`${section} settings saved`)
    setTimeout(() => setSaveSuccess(null), 2000)
  }

  // Save shift configurations to database
  const handleSaveShifts = async () => {
    try {
      console.log("[v0] Saving shift configurations...")
      
      // Process full-time shifts (Sync current state with DB)
      const currentFtShifts = fullTimeShifts.slice(0, ftCount)
      for (let i = 0; i < currentFtShifts.length; i++) {
        const shift = currentFtShifts[i]
        const configName = `Full-time Shift ${i + 1}`
        
        const existingConfig = dbShiftConfigs.find(c => c.name === configName)
        
        if (existingConfig) {
          await updateShiftConfig(existingConfig.id, {
            name: configName,
            start_time: shift.start_time,
            end_time: shift.end_time
          })
        } else {
          await addShiftConfig({
            name: configName,
            start_time: shift.start_time,
            end_time: shift.end_time
          })
        }
      }

      // Delete removed full-time shifts from DB
      const ftConfigsToDelete = dbShiftConfigs.filter(c => 
        c.name.startsWith("Full-time Shift") && 
        parseInt(c.name.split(" ").pop() || "0") > ftCount
      )
      for (const config of ftConfigsToDelete) {
        await deleteShiftConfig(config.id)
      }
      
      // Process part-time shifts
      const currentPtShifts = partTimeShifts.slice(0, ptCount)
      for (let i = 0; i < currentPtShifts.length; i++) {
        const shift = currentPtShifts[i]
        const configName = `Part-time Shift ${i + 1}`
        
        const existingConfig = dbShiftConfigs.find(c => c.name === configName)
        
        if (existingConfig) {
          await updateShiftConfig(existingConfig.id, {
            name: configName,
            start_time: shift.start_time,
            end_time: shift.end_time
          })
        } else {
          await addShiftConfig({
            name: configName,
            start_time: shift.start_time,
            end_time: shift.end_time
          })
        }
      }

      // Delete removed part-time shifts from DB
      const ptConfigsToDelete = dbShiftConfigs.filter(c => 
        c.name.startsWith("Part-time Shift") && 
        parseInt(c.name.split(" ").pop() || "0") > ptCount
      )
      for (const config of ptConfigsToDelete) {
        await deleteShiftConfig(config.id)
      }
      
      // Refresh configs from database
      await fetchShiftConfigs()
      
      toast.success("Shift configurations saved")
      setSaveSuccess("Shifts")
      setTimeout(() => setSaveSuccess(null), 2000)
    } catch (error) {
      console.log("[v0] ERROR saving shifts:", error)
      toast.error("Failed to save shift configurations")
    }
  }

  // Update a shift time
  const updateShiftTime = (
    type: "full-time" | "part-time", 
    index: number, 
    field: "start_time" | "end_time", 
    value: string
  ) => {
    if (type === "full-time") {
      setFullTimeShifts(prev => {
        const newShifts = [...prev]
        // Ensure index exists
        if (!newShifts[index]) {
          newShifts[index] = { 
            id: `ft-${Date.now()}-${index}`, 
            label: `Full-time Shift ${index + 1}`, 
            start_time: "08:00", 
            end_time: "16:00", 
            type: "full-time" 
          }
        }
        newShifts[index] = { ...newShifts[index], [field]: value }
        return newShifts
      })
    } else {
      setPartTimeShifts(prev => {
        const newShifts = [...prev]
        // Ensure index exists
        if (!newShifts[index]) {
          newShifts[index] = { 
            id: `pt-${Date.now()}-${index}`, 
            label: `Part-time Shift ${index + 1}`, 
            start_time: "08:00", 
            end_time: "12:00", 
            type: "part-time" 
          }
        }
        newShifts[index] = { ...newShifts[index], [field]: value }
        return newShifts
      })
    }
  }
  
  // Filter employees by role for display
  const adminsAndSuperAdmins = employees.filter(e => e.role === 'admin' || e.role === 'super_admin')
  const regularEmployees = employees.filter(e => e.role === 'employee' || !e.role)

  // Don't render if not main super admin
  if (!isMainSuperAdmin()) {
    return null
  }

  return (
    <div>
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-light tracking-tight">Settings</h1>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-sm">
            <Crown className="w-3 h-3" />
            Super Admin
          </span>
        </div>
        <p className="text-muted-foreground">Configure your coffee shop system (Super Admin only)</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[calc(100vh-200px)] overflow-y-auto pb-6">
        {/* Shop Info */}
        <Card className="rounded-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              <CardTitle>Shop Information</CardTitle>
            </div>
            <CardDescription>Basic details about your coffee shop</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shopName">Shop Name</Label>
              <Input id="shopName" defaultValue={shopInfo.name} className="rounded-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input id="tagline" defaultValue={shopInfo.tagline} className="rounded-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" defaultValue={shopInfo.address} className="rounded-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" defaultValue={shopInfo.phone} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" defaultValue={shopInfo.email} className="rounded-sm" />
              </div>
            </div>
            <Button 
              onClick={() => handleSave("Shop")} 
              className="rounded-sm"
            >
              {saveSuccess === "Shop" ? <Check className="w-4 h-4 mr-2" /> : null}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Operating Hours */}
        <Card className="rounded-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <CardTitle>Operating Hours</CardTitle>
            </div>
            <CardDescription>Set your shop opening and closing times</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="weekday">Weekday Hours (Mon-Fri)</Label>
              <Input id="weekday" defaultValue={shopInfo.hours.weekday} className="rounded-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekend">Weekend Hours (Sat-Sun)</Label>
              <Input id="weekend" defaultValue={shopInfo.hours.weekend} className="rounded-sm" />
            </div>
            <Button 
              onClick={() => handleSave("Hours")} 
              className="rounded-sm"
            >
              {saveSuccess === "Hours" ? <Check className="w-4 h-4 mr-2" /> : null}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="rounded-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Configure stock and system alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lowStockDays">Low Stock Alert (days remaining)</Label>
              <Input id="lowStockDays" type="number" defaultValue={3} className="rounded-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="criticalStockDays">Critical Stock Alert (days remaining)</Label>
              <Input id="criticalStockDays" type="number" defaultValue={1} className="rounded-sm" />
            </div>
            <Button 
              onClick={() => handleSave("Notifications")} 
              className="rounded-sm"
            >
              {saveSuccess === "Notifications" ? <Check className="w-4 h-4 mr-2" /> : null}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="rounded-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Operational interface settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="idleTimeout">Idle Timeout (seconds)</Label>
              <Input id="idleTimeout" type="number" defaultValue={30} className="rounded-sm" />
              <p className="text-xs text-muted-foreground">
                Time before the operational interface returns to idle screen
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="requireNFC">NFC Requirement</Label>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="requireNFC" defaultChecked className="rounded" />
                <span className="text-sm">Require NFC tap for all operations</span>
              </div>
            </div>
            <Button 
              onClick={() => handleSave("Security")} 
              className="rounded-sm"
            >
              {saveSuccess === "Security" ? <Check className="w-4 h-4 mr-2" /> : null}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Shift Configuration */}
        <Card className="rounded-sm lg:col-span-2 overflow-hidden border-none shadow-lg bg-gradient-to-br from-card to-muted/20">
          <CardHeader className="border-b bg-muted/10 pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-sm">
                  <CalendarClock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Shift Configuration</CardTitle>
                  <CardDescription>
                    Define fixed shift time slots for scheduling.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Full-time Shifts Column */}
              <div className="p-6 border-b lg:border-b-0 lg:border-r space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600 text-white border-transparent px-3">Full-time</Badge>
                    <span className="text-sm font-medium text-muted-foreground">Standard Shifts</span>
                  </div>
                  <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-sm border">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Total Slots:</Label>
                    <Input 
                      type="number" 
                      min={1} 
                      max={6} 
                      value={ftCount} 
                      onChange={(e) => setFtCount(parseInt(e.target.value) || 1)}
                      className="w-12 h-7 text-xs text-center border-none bg-transparent focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {Array.from({ length: ftCount }).map((_, index) => {
                    const shift = fullTimeShifts[index] || { id: `new-ft-${index}`, start_time: "06:00", end_time: "14:00", label: `Full-time Shift ${index+1}` }
                    return (
                      <div key={shift.id || index} className="group p-4 rounded-sm border bg-card hover:border-primary/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-xs font-bold uppercase tracking-widest text-primary/70">{shift.label || `FT Shift ${index+1}`}</p>
                          <Clock className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground font-semibold uppercase">Start</Label>
                            <Input 
                              type="time"
                              value={shift.start_time}
                              onChange={(e) => updateShiftTime("full-time", index, "start_time", e.target.value)}
                              className="rounded-sm h-10 font-mono text-sm border-muted-foreground/20 focus:border-primary w-full"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground font-semibold uppercase">End</Label>
                            <Input 
                              type="time"
                              value={shift.end_time}
                              onChange={(e) => updateShiftTime("full-time", index, "end_time", e.target.value)}
                              className="rounded-sm h-10 font-mono text-sm border-muted-foreground/20 focus:border-primary w-full"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Part-time Shifts Column */}
              <div className="p-6 bg-muted/5 space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-teal-600 text-white border-transparent px-3">Part-time</Badge>
                    <span className="text-sm font-medium text-muted-foreground">Flexible Shifts</span>
                  </div>
                  <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-sm border">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Total Slots:</Label>
                    <Input 
                      type="number" 
                      min={1} 
                      max={12} 
                      value={ptCount} 
                      onChange={(e) => setPtCount(parseInt(e.target.value) || 1)}
                      className="w-12 h-7 text-xs text-center border-none bg-transparent focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: ptCount }).map((_, index) => {
                    const shift = partTimeShifts[index] || { id: `new-pt-${index}`, start_time: "08:00", end_time: "12:00", label: `Part-time Shift ${index+1}` }
                    return (
                      <div key={shift.id || index} className="group p-4 rounded-sm border bg-card hover:border-teal-500/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-xs font-bold uppercase tracking-widest text-teal-600/70">{shift.label || `PT Shift ${index+1}`}</p>
                          <Timer className="w-3 h-3 text-muted-foreground group-hover:text-teal-600 transition-colors" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground font-semibold uppercase">Start</Label>
                            <Input 
                              type="time"
                              value={shift.start_time}
                              onChange={(e) => updateShiftTime("part-time", index, "start_time", e.target.value)}
                              className="rounded-sm h-10 font-mono text-sm border-muted-foreground/20 focus:border-teal-500/50 w-full"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground font-semibold uppercase">End</Label>
                            <Input 
                              type="time"
                              value={shift.end_time}
                              onChange={(e) => updateShiftTime("part-time", index, "end_time", e.target.value)}
                              className="rounded-sm h-10 font-mono text-sm border-muted-foreground/20 focus:border-teal-500/50 w-full"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            
            {/* Added Save button at the bottom */}
            <div className="p-6 border-t bg-muted/5 flex justify-end">
              <Button 
                onClick={handleSaveShifts} 
                className="rounded-sm shadow-sm hover:shadow-md transition-all px-8 py-6"
              >
                {saveSuccess === "Shifts" ? <Check className="h-5 w-5 mr-2" /> : <Timer className="h-5 w-5 mr-2" />}
                <span className="text-base">Save Shift Configuration</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Role Management */}
        <Card className="rounded-sm lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <CardTitle>Role Management</CardTitle>
            </div>
            <CardDescription>
              Manage employee roles. Promotion path: Employee → Admin → Super Admin (temporary with countdown).
              Super Admin can only be demoted to Admin (not directly to Employee).
              The main super admin cannot be modified.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Current Admins & Super Admins */}
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Admins & Super Admins ({adminsAndSuperAdmins.length})
                  </h3>
                  {adminsAndSuperAdmins.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No admins assigned yet</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {adminsAndSuperAdmins.map((emp) => {
                        const allowedChanges = getAllowedRoleChanges(emp)
                        const isTemporarySuperAdmin = emp.role === 'super_admin' && emp.super_admin_expires_at && !isEmployeeMainSuperAdmin(emp)
                        
                        return (
                          <div 
                            key={emp.id}
                            className="flex items-center justify-between p-3 rounded-sm bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-medium text-sm">
                                  {emp.nickname || emp.name}
                                  <span className="text-muted-foreground font-normal"> — </span>
                                  <span className="capitalize text-muted-foreground">
                                    {emp.position || "Employee"}
                                  </span>
                                </p>
                                <p className="text-xs text-muted-foreground">{emp.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getRoleBadge(emp)}
                              {/* Cancel button for temporary super admins */}
                              {isTemporarySuperAdmin && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="rounded-sm text-xs text-destructive border-destructive/50 hover:bg-destructive/10"
                                  onClick={() => handleCancelSuperAdmin(emp)}
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Cancel
                                </Button>
                              )}
                              {/* Regular role change buttons */}
                              {allowedChanges.map(change => (
                                <Button 
                                  key={change.role}
                                  variant="outline" 
                                  size="sm"
                                  className="rounded-sm text-xs"
                                  onClick={() => initiateRoleChange(emp, change.role)}
                                >
                                  {change.isPromotion ? (
                                    <ArrowUp className="w-3 h-3 mr-1" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3 mr-1" />
                                  )}
                                  {change.role === 'admin' && emp.role === 'employee' ? 'Promote' :
                                   change.role === 'super_admin' ? 'Super Admin' :
                                   'Demote'}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Employees that can be promoted */}
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Employees ({regularEmployees.length})
                  </h3>
                  {regularEmployees.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No employees to promote</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {regularEmployees.map((emp) => (
                        <div 
                          key={emp.id}
                          className="flex items-center justify-between p-3 rounded-sm bg-muted/30"
                        >
                          <div>
                            <p className="font-medium text-sm">
                              {emp.nickname || emp.name}
                              <span className="text-muted-foreground font-normal"> — </span>
                              <span className="capitalize text-muted-foreground">
                                {emp.position || "Employee"}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">{emp.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getRoleBadge(emp)}
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="rounded-sm text-xs"
                              onClick={() => initiateRoleChange(emp, 'admin')}
                            >
                              <ArrowUp className="w-3 h-3 mr-1" />
                              Promote to Admin
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Role Change Confirmation Dialog */}
      <AlertDialog open={roleChangeConfirmOpen} onOpenChange={setRoleChangeConfirmOpen}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {targetRole === 'employee' ? 'Demote to Employee' : 
               targetRole === 'super_admin' ? 'Promote to Super Admin' : 
               targetRole === 'admin' && selectedEmployee?.role === 'super_admin' ? 'Demote to Admin' :
               'Promote to Admin'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {targetRole === 'employee' ? (
                  <p>Are you sure you want to demote <strong>{selectedEmployee?.name}</strong> to employee? They will lose access to the admin dashboard.</p>
                ) : targetRole === 'super_admin' ? (
                  <>
                    <p>Are you sure you want to promote <strong>{selectedEmployee?.name}</strong> to super admin? They will have full system access including Settings.</p>
                    <div className="space-y-2">
                      <Label htmlFor="duration" className="flex items-center gap-2">
                        <Timer className="w-4 h-4" />
                        Access Duration *
                      </Label>
                      <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                        <SelectTrigger className="rounded-sm">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATION_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        A countdown timer will be shown. When time expires, they will automatically be demoted to admin.
                      </p>
                    </div>
                  </>
                ) : targetRole === 'admin' && selectedEmployee?.role === 'super_admin' ? (
                  <p>Are you sure you want to demote <strong>{selectedEmployee?.name}</strong> to admin? They will lose access to Settings.</p>
                ) : (
                  <p>Are you sure you want to promote <strong>{selectedEmployee?.name}</strong> to admin? They will gain access to the admin dashboard.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRoleChange}
              className="rounded-sm"
              disabled={targetRole === 'super_admin' && !durationMinutes}
            >
              {targetRole === 'employee' || (targetRole === 'admin' && selectedEmployee?.role === 'super_admin') 
                ? 'Demote' 
                : 'Promote'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
