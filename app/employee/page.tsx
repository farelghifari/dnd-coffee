"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { 
  getEmployeeById,
  getAttendanceByEmployee,
  getShiftsByEmployee,
  getInventory,
  getLowStockItems,
  getOnShiftEmployees,
  getOverallStockHealth,
  getStockHealth,
  getShiftConfigs,
  getAttendanceStats,
  getEmployeePayrolls,
  type Employee,
  type AttendanceLog,
  type InventoryItem,
  type ShiftAssignment,
  type ShiftConfig,
  type PayrollRecord
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Coffee,
  Package,
  Bell,
  TrendingUp,
  LayoutDashboard,
  Wallet,
  Users
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { format } from "date-fns"
import { cn, getLocalYYYYMMDD } from "@/lib/utils"

export default function EmployeeDashboard() {
  const { user, canAccessAdmin } = useAuth()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [myAttendance, setMyAttendance] = useState<AttendanceLog[]>([])
  const [myShifts, setMyShifts] = useState<ShiftAssignment[]>([])
  const [shiftConfigs, setShiftConfigs] = useState<ShiftConfig[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [onShift, setOnShift] = useState<Employee[]>([])
  const [performanceStats, setPerformanceStats] = useState<{ 
    totalHours: number; 
    totalRegHours?: number;
    totalOTHours?: number;
    lateCount: number; 
    penaltyCount?: number;
    entryCount: number 
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [myPayrolls, setMyPayrolls] = useState<PayrollRecord[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.employeeId) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      
      const [employeeData, attendanceData, shiftsData, inventoryData, onShiftData, configsData, statsData, payrollData] = await Promise.all([
        getEmployeeById(user.employeeId),
        getAttendanceByEmployee(user.employeeId),
        getShiftsByEmployee(user.employeeId),
        getInventory(),
        getOnShiftEmployees(),
        getShiftConfigs(),
        getAttendanceStats(user.employeeId),
        getEmployeePayrolls(user.employeeId)
      ])


      setEmployee(employeeData)
      setMyAttendance(attendanceData)
      setMyShifts(shiftsData)
      setInventory(inventoryData)
      setOnShift(onShiftData)
      setShiftConfigs(configsData)
      setPerformanceStats(statsData as any)
      setMyPayrolls(payrollData)
      setIsLoading(false)

    }

    fetchData()
  }, [user?.employeeId])

  // Get today's attendance
  const today = getLocalYYYYMMDD()
  const todayAttendance = myAttendance.filter(log => log.timestamp.startsWith(today))
  
  // Check if currently clocked in
  const clockedIn = todayAttendance.length > 0 && 
    todayAttendance[0].type === "clock-in"

  // Get low stock items for alerts
  const lowStockItems = getLowStockItems(inventory)

  // Get shift schedule based on employee's assigned shift
  const getShiftTimes = (shift: string) => {
    switch (shift) {
      case "morning": return "06:00 - 14:00"
      case "afternoon": return "13:00 - 21:00"
      case "evening": return "17:00 - 23:00"
      default: return "TBD"
    }
  }

  // Get shift name from config or use custom label
  const getShiftDisplayName = (shift: ShiftAssignment): string => {
    // If shift has a name stored, use it
    if (shift.shift_name) return shift.shift_name
    
    // If shift has a config id, find the config
    if (shift.shift_config_id) {
      const config = shiftConfigs.find(c => c.id === shift.shift_config_id)
      if (config) return config.name
    }
    
    // Try to match by time
    const matchingConfig = shiftConfigs.find(c => 
      c.start_time === shift.start_time && c.end_time === shift.end_time
    )
    if (matchingConfig) return matchingConfig.name
    
    // Return custom label
    return "Custom Shift"
  }

  // Calculate shift duration in hours
  const getShiftDurationHours = (startTime: string, endTime: string): number => {
    const [startH, startM] = startTime.split(":").map(Number)
    const [endH, endM] = endTime.split(":").map(Number)
    
    let startMinutes = startH * 60 + startM
    let endMinutes = endH * 60 + endM
    
    // Handle overnight shifts
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60
    }
    
    return (endMinutes - startMinutes) / 60
  }

  // Determine shift type based on duration: >= 8 hours = Full Time, < 8 hours = Part Time
  const getShiftType = (shift: ShiftAssignment): "Full Time" | "Part Time" => {
    const duration = getShiftDurationHours(shift.start_time, shift.end_time)
    return duration >= 8 ? "Full Time" : "Part Time"
  }

  // Stock health percentage
  const stockHealth = getOverallStockHealth(inventory)

  // Critical items count
  const criticalItems = inventory.filter(item => getStockHealth(item) === "critical").length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {employee?.nickname || employee?.name || user?.name || "Employee"}
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        
        {/* Show Admin Dashboard button only for admin/super_admin */}
        {canAccessAdmin() && (
          <Button asChild className="rounded-sm">
            <Link href="/admin">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              View Dashboard
            </Link>
          </Button>
        )}
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Clock Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clock Status</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {clockedIn ? (
                <>
                  <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                    Clocked In
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Since {todayAttendance[0] && format(new Date(todayAttendance[0].timestamp), "HH:mm")}
                  </span>
                </>
              ) : (
                <Badge variant="secondary">Not Clocked In</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Today's Shift */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{"Today's Shift"}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {(() => {
              const todayShift = myShifts.find(s => s.date === today)
              if (todayShift) {
                const shiftType = getShiftType(todayShift)
                return (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">{getShiftDisplayName(todayShift)}</span>
                      <Badge 
                        variant="outline" 
                        className={shiftType === "Full Time" 
                          ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" 
                          : "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                        }
                      >
                        {shiftType}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {todayShift.start_time} - {todayShift.end_time}
                    </span>
                  </div>
                )
              }
              return (
                <div className="flex flex-col">
                  <span className="text-lg font-semibold text-muted-foreground">No Shift</span>
                  <span className="text-xs text-muted-foreground">
                    No shift scheduled for today
                  </span>
                </div>
              )
            })()}
          </CardContent>
        </Card>

        {/* My Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">My Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{Math.round(performanceStats?.totalHours || 0)}h</span>
                <Badge 
                  variant={ (performanceStats?.lateCount || 0) > 0 ? "destructive" : "outline"}
                  className="rounded-sm text-[10px]"
                >
                  {(performanceStats?.lateCount || 0)} LATE
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                This Month&apos;s Statistics
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stock Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stock Health</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{stockHealth}%</span>
              {stockHealth >= 80 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : stockHealth >= 50 ? (
                <TrendingUp className="h-5 w-5 text-yellow-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Staff On Shift */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Staff On Shift</CardTitle>
            <Coffee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onShift.length}</div>
            <p className="text-xs text-muted-foreground">
              {onShift.map(e => e.nickname).join(", ") || "No one clocked in"}
            </p>
          </CardContent>
        </Card>

        {/* Salary & Payroll Card */}
        <Card className="bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-900 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Wallet size={64} className="text-green-600" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-green-600" />
              Latest Salary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myPayrolls.filter(p => p.status === 'settled').length > 0 ? (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-700 dark:text-green-500">
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    minimumFractionDigits: 0
                  }).format(myPayrolls.find(p => p.status === 'settled')?.total_payroll || 0)}
                </div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                  Finalized Period: {myPayrolls.find(p => p.status === 'settled')?.end_date}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-muted-foreground/30">—</div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">No Settled Payroll</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Attendance History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              My Attendance History
            </CardTitle>
            <CardDescription>Your recent clock in/out records</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              {myAttendance.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {myAttendance.slice(0, 20).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        {log.type === "clock-in" ? (
                          <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm capitalize">
                            {(log.type || log.action || "clock-in").replace("-", " ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(log.timestamp || `${log.date}T${log.time}`), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-mono">
                        {format(new Date(log.timestamp || `${log.date}T${log.time}`), "HH:mm")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Clock className="h-12 w-12 mb-2 opacity-50" />
                  <p>No attendance records yet</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Notifications / Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Alerts and important updates</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="flex flex-col gap-3">
                {/* Low Stock Alerts */}
                {criticalItems > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800 dark:text-red-200">
                          Critical Stock Alert
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-300">
                          {criticalItems} item(s) are critically low. Check inventory before service.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {lowStockItems.length > 0 && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Package className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">
                          Low Stock Warning
                        </p>
                        <p className="text-sm text-yellow-600 dark:text-yellow-300">
                          {lowStockItems.map((i: any) => i.name).slice(0, 3).join(", ")}
                          {lowStockItems.length > 3 && ` +${lowStockItems.length - 3} more`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* General Info */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Coffee className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800 dark:text-blue-200">
                        Shop Status
                      </p>
                      <p className="text-sm text-blue-600 dark:text-blue-300">
                        {onShift.length > 0 
                          ? `Shop is operational with ${onShift.length} staff member(s)`
                          : "No staff currently on shift"
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reminder */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Reminder</p>
                      <p className="text-sm text-muted-foreground">
                        Remember to clock in/out using the NFC terminal at the operational station.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* My Assigned Shifts - Weekly Calendar View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            My Weekly Schedule
          </CardTitle>
          <CardDescription>Your schedule for the next 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {(() => {
              const dates = []
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              
              for (let i = 0; i < 7; i++) {
                const date = new Date(today)
                date.setDate(today.getDate() + i)
                const dateStr = getLocalYYYYMMDD(date)
                const shiftsForDay = myShifts.filter(s => s.date === dateStr)
                
                dates.push({
                  date,
                  dateStr,
                  shifts: shiftsForDay,
                  isToday: i === 0
                })
              }
              
              return dates.map(({ date, dateStr, shifts, isToday }) => (
                <div
                  key={dateStr}
                  className={cn(
                    "flex flex-col p-3 border rounded-lg transition-all",
                    isToday ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20" : "bg-card",
                    shifts.length === 0 ? "opacity-60" : "shadow-sm"
                  )}
                >
                  <div className="flex flex-col mb-2">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      isToday ? "text-primary" : "text-muted-foreground"
                    )}>
                      {format(date, "EEEE")}
                    </span>
                    <span className="text-sm font-semibold">
                      {format(date, "MMM d")}
                    </span>
                    {isToday && <Badge className="mt-1 h-4 text-[9px] w-fit px-1.5">Today</Badge>}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    {shifts.length > 0 ? (
                      shifts.map(shift => {
                        const shiftType = getShiftType(shift)
                        return (
                          <div key={shift.id} className="space-y-1">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[9px] h-4 py-0 leading-none",
                                shiftType === "Full Time" 
                                  ? "bg-blue-50 text-blue-700 border-blue-200" 
                                  : "bg-green-50 text-green-700 border-green-200"
                              )}
                            >
                              {shiftType}
                            </Badge>
                            <p className="text-xs font-medium leading-tight text-foreground/90">
                              {getShiftDisplayName(shift)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {shift.start_time}-{shift.end_time}
                            </p>
                          </div>
                        )
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-2 h-full">
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full uppercase tracking-tighter">Day Off</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Low Stock Items Detail */}
      {lowStockItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Low Stock Items
            </CardTitle>
            <CardDescription>Items that need attention</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {lowStockItems.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.current_stock} {item.unit} remaining
                      </p>
                    </div>
                    <Badge
                      variant={item.daysRemaining <= 1 ? "destructive" : "secondary"}
                      className={item.daysRemaining <= 1 ? "" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"}
                    >
                      {item.daysRemaining}d left
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
