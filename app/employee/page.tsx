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
  getScheduledOvertime,
   getEmployeePayrolls,
   getOvertimeRequestsByEmployee,
   addOvertimeRequest,
   getShiftOnDate,
   hasShiftOnDate,
   getDailyWorkDuration,
   calculateRegulatedSession,
   getOutlets,
   addAttendanceLog,
   updateEmployee,
   type Employee,
   type AttendanceLog,
  type InventoryItem,
  type ShiftAssignment,
  type ShiftConfig,
  type PayrollRecord,
  type OvertimeRequest,
  type Outlet
} from "@/lib/api/supabase-service"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Users,
  MapPin,
  Navigation,
  Locate
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { format } from "date-fns"
import { cn, getLocalYYYYMMDD, calculateDistance } from "@/lib/utils"
import { toast } from "sonner"

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
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [nearestOutlet, setNearestOutlet] = useState<{ outlet: Outlet; distance: number } | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isOTPromptOpen, setIsOTPromptOpen] = useState(false)
  const [otPromptMessage, setOTPromptMessage] = useState("")

  const fetchData = async () => {
    if (!user?.employeeId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    
    const [employeeData, attendanceData, shiftsData, inventoryData, onShiftData, configsData, statsData, payrollData, otData, outletsData] = await Promise.all([
      getEmployeeById(user.employeeId),
      getAttendanceByEmployee(user.employeeId),
      getShiftsByEmployee(user.employeeId),
      getInventory(),
      getOnShiftEmployees(),
      getShiftConfigs(),
      getAttendanceStats(user.employeeId),
      getEmployeePayrolls(user.employeeId),
      getOvertimeRequestsByEmployee(user.employeeId),
      getOutlets()
    ])


    setEmployee(employeeData)
    setMyAttendance(attendanceData)
    setMyShifts(shiftsData)
    setInventory(inventoryData)
    setOnShift(onShiftData)
    setShiftConfigs(configsData)
    setPerformanceStats(statsData as any)
    setMyPayrolls(payrollData)
    setOvertimeRequests(otData)
    setOutlets(outletsData)
    setIsLoading(false)

  }

  useEffect(() => {
    fetchData()
  }, [user?.employeeId])

  // Get current location periodically or on mount
  useEffect(() => {
    if (outlets.length === 0) return

    const getPosition = () => {
      setIsLocating(true)
      setLocationError(null)
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          setUserLocation({ lat, lng })
          
          // Find nearest outlet
          let minDistance = Infinity
          let closest: Outlet | null = null
          
          outlets.filter(o => o.is_active).forEach(outlet => {
            const dist = calculateDistance(lat, lng, outlet.latitude, outlet.longitude)
            if (dist < minDistance) {
              minDistance = dist
              closest = outlet
            }
          })
          
          if (closest) {
            setNearestOutlet({ outlet: closest, distance: minDistance })
          }
          setIsLocating(false)
        },
        (error) => {
          let msg = "Could not get location"
          if (error.code === 1) msg = "Location access denied"
          else if (error.code === 2) msg = "Location unavailable"
          else if (error.code === 3) msg = "Location timeout"
          
          setLocationError(msg)
          setIsLocating(false)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    }

    getPosition()
    const interval = setInterval(getPosition, 60000) // Refresh location every minute
    return () => clearInterval(interval)
  }, [outlets])

  // Get today's attendance (sorted newest first)
  const today = getLocalYYYYMMDD()
  const todayAttendance = myAttendance
    .filter(log => log.timestamp.startsWith(today))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  
  // Check if currently clocked in (Latest action must be clock-in AND NOT REJECTED)
  const lastAttendance = todayAttendance[0]
  const clockedIn = todayAttendance.length > 0 && 
    lastAttendance.type === "clock-in" &&
    lastAttendance.status !== "rejected"
  
  const lastWasRejected = todayAttendance.length > 0 && lastAttendance.status === "rejected"

  // Determine current overtime status for this session
  const currentOTRequest = clockedIn && lastAttendance
    ? overtimeRequests.find(ot => ot.attendance_log_id === lastAttendance.id)
    : null
  const currentOTStatus = currentOTRequest?.status || null // 'pending' | 'approved' | 'rejected' | null

  // Get today's shift
  const todayShift = myShifts.find(s => s.date === today)

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
    
    let diff = (endH * 60 + endM) - (startH * 60 + startM)
    if (diff < 0) diff += 24 * 60 // Handle overnight shifts
    return diff / 60
  }

  const getDeviceId = () => {
    if (typeof window === 'undefined') return "unknown"
    let id = localStorage.getItem('dnd_device_id')
    if (!id) {
      id = `dnd-dev-${Math.random().toString(36).substring(2, 11)}-${Date.now()}`
      localStorage.setItem('dnd_device_id', id)
    }
    return id
  }

  const handleClockAction = async (type: "clock-in" | "clock-out") => {
    if (!user?.employeeId || !userLocation || !nearestOutlet) {
      toast.error("Required data missing. Ensure GPS is enabled.")
      return
    }

    // Validate distance
    if (nearestOutlet.distance > nearestOutlet.outlet.radius_meters) {
      toast.error(`You are too far from ${nearestOutlet.outlet.name} (${Math.round(nearestOutlet.distance)}m away)`)
      return
    }

    setIsSubmitting(true)

    // Capture device info
    const deviceInfo = `${navigator.platform} - ${navigator.userAgent.split(')')[0].split('(')[1]}`
    const deviceFingerprint = getDeviceId()

    // Rule: Strict Device Lock
    if (employee?.registered_device && employee.registered_device !== deviceFingerprint) {
      toast.error("Device Mismatch: This account is locked to another device. Please contact Admin if you changed your phone.")
      return
    }
    try {
      const today = getLocalYYYYMMDD()
      const todayShift = await getShiftOnDate(user.employeeId, today)
      const hasShift = !!todayShift
      
      // 1. Check for scheduled overtime first
      const scheduledOT = await getScheduledOvertime(user.employeeId, today)

      if (type === "clock-in") {
        if (scheduledOT) {
          const attendanceLog = await addAttendanceLog({
            employee_id: user.employeeId,
            employee_name: employee?.name || user.name,
            type,
            method: 'personal',
            device_info: deviceInfo,
            latitude: userLocation.lat,
            longitude: userLocation.lng,
            outlet_id: nearestOutlet.outlet.id,
            is_ops_device: false
          })
          
          if (attendanceLog) {
            toast.success("Clocked in for SCHEDULED overtime!")
            await fetchData()
          }
          setIsSubmitting(false)
          return
        }

        // 2. Check regular shift rules
        if (todayShift) {
          const shiftStart = new Date(`${todayShift.date}T${todayShift.start_time}`)
          const shiftEnd = new Date(`${todayShift.date}T${todayShift.end_time}`)
          if (todayShift.end_time < todayShift.start_time) shiftEnd.setDate(shiftEnd.getDate() + 1)
          
          const now = new Date()
          const earlyMins = Math.round((shiftStart.getTime() - now.getTime()) / 60000)
          
          // Rule 1: Too early - show interactive prompt
          if (earlyMins > 45) {
            const earliestTime = new Date(shiftStart.getTime() - 45 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
            setOTPromptMessage(`Clock-in too early. You can only clock in from ${earliestTime} (45 mins before shift). Do you want to request overtime instead?`)
            setIsOTPromptOpen(true)
            setIsSubmitting(false)
            return
          }

          // Rule 3: Post-shift - auto-request OT
          if (now > shiftEnd) {
            const attendanceLog = await addAttendanceLog({
              employee_id: user.employeeId,
              employee_name: employee?.name || user.name,
              type,
              method: 'personal',
              device_info: deviceInfo,
              latitude: userLocation.lat,
              longitude: userLocation.lng,
              outlet_id: nearestOutlet.outlet.id,
              is_ops_device: false
            })
            
            if (attendanceLog) {
              await addOvertimeRequest({
                employee_id: user.employeeId,
                employee_name: employee?.name || user.name || "Unknown",
                attendance_log_id: attendanceLog.id,
                request_date: today,
                clock_in_time: new Date().toISOString(),
                status: "pending"
              })
              toast.warning("Clocked in (Post-shift work — Overtime request submitted automatically)")
              await fetchData()
            }
            setIsSubmitting(false)
            return
          }
        }
      }

      const attendanceLog = await addAttendanceLog({
        employee_id: user.employeeId,
        employee_name: employee?.name || user.name,
        type,
        method: 'personal',
        device_info: deviceInfo,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        outlet_id: nearestOutlet.outlet.id,
        is_ops_device: false
      })

      if (attendanceLog) {
        // Update last_device_id in employee profile
        await updateEmployee(user.employeeId, { last_device_id: deviceFingerprint })
        
        if (type === "clock-in") {
          const duration = await getDailyWorkDuration(user.employeeId, today)
          
          if (hasShift) {
            if (duration.isLate) {
              toast.warning(`Clocked in successfully — LATE (> 15 mins)`)
            } else {
              toast.success(`Clocked in successfully — Punctual`)
            }
          } else {
            // No shift - create overtime request
            await addOvertimeRequest({
              employee_id: user.employeeId,
              employee_name: employee?.name || user.name || "Unknown",
              attendance_log_id: attendanceLog.id,
              request_date: today,
              clock_in_time: new Date().toISOString(),
              status: "pending"
            })
            toast.warning("Clocked in (No shift scheduled — Overtime request submitted for approval)")
          }
        } else {
          toast.success("Clocked out successfully")
        }
        
        // Refresh data to update status across the dashboard
        await fetchData()
      } else {
        toast.error("Failed to record attendance")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMobileOvertimeRequest = async () => {
    if (!user?.employeeId || !userLocation || !nearestOutlet) return
    
    setIsSubmitting(true)
    const today = getLocalYYYYMMDD()
    const deviceInfo = `${navigator.platform} - ${navigator.userAgent.split(')')[0].split('(')[1]}`
    
    try {
      const attendanceLog = await addAttendanceLog({
        employee_id: user.employeeId,
        employee_name: employee?.name || user.name,
        type: "clock-in",
        method: 'personal',
        device_info: deviceInfo,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        outlet_id: nearestOutlet.outlet.id,
        is_ops_device: false
      })
      
      if (attendanceLog) {
        await addOvertimeRequest({
          employee_id: user.employeeId,
          employee_name: employee?.name || user.name || "Unknown",
          attendance_log_id: attendanceLog.id,
          request_date: today,
          clock_in_time: new Date().toISOString(),
          status: "pending"
        })
        toast.warning("Overtime request submitted for early clock-in")
        setIsOTPromptOpen(false)
        await fetchData()
      }
    } catch (error) {
      toast.error("Failed to submit overtime request")
    } finally {
      setIsSubmitting(false)
    }
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

  // Calculate missing shifts (absences)
  const missedShifts = myShifts.filter(s => {
    // Only check past shifts or today's shifts that have already passed their scheduled end time
    const endTimeStr = s.end_time || '23:59'
    const shiftEndDateObj = new Date(`${s.date}T${endTimeStr}`)
    
    // Handle overnight shifts
    if (s.start_time && endTimeStr < s.start_time) {
      shiftEndDateObj.setDate(shiftEndDateObj.getDate() + 1)
    }
    
    if (shiftEndDateObj > new Date()) return false 
    
    const logExists = myAttendance.some(log => {
      const logDate = log.date || (log.timestamp ? log.timestamp.split('T')[0] : '')
      return logDate === s.date
    })
    
    return !logExists
  })

  // Calculate late records (15 mins grace period)
  const lateRecords = [...myShifts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Newest first
    .map(shift => {
      const shiftLogs = myAttendance.filter(log => {
        const logDate = log.date || (log.timestamp ? log.timestamp.split('T')[0] : '')
        return logDate === shift.date && (log.type === 'clock-in' || log.action === 'clock-in')
      }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      
      const firstIn = shiftLogs[0]
      if (!firstIn) return null
      
      const shiftStartObj = new Date(`${shift.date}T${shift.start_time}`)
      const realInObj = new Date(firstIn.timestamp || `${firstIn.date}T${firstIn.time}`)
      const lateMins = Math.max(0, Math.floor((realInObj.getTime() - shiftStartObj.getTime()) / 60000))
      
      if (lateMins > 15) { 
        return {
          id: shift.id,
          date: shift.date,
          shiftName: getShiftDisplayName(shift),
          startTime: shift.start_time,
          clockInTime: format(realInObj, "HH:mm"),
          lateMins,
        }
      }
      return null
    })
    .filter(Boolean) as Array<{ id: string; date: string; shiftName: string; startTime: string; clockInTime: string; lateMins: number }>

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
          <CardHeader className="flex flex-row items-center justify-between pb-2 text-primary font-bold">
            <CardTitle className="text-sm font-medium">Clock Status</CardTitle>
            <Clock className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1.5">
              {clockedIn ? (
                <>
                  <div className="flex items-center gap-2">
                    {currentOTStatus === 'pending' ? (
                      <Badge variant="outline" className="rounded-sm border-amber-500/50 text-amber-600 bg-amber-500/10 animate-pulse">
                        OT Pending
                      </Badge>
                    ) : currentOTStatus === 'approved' ? (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600 rounded-sm">
                        OT Active
                      </Badge>
                    ) : currentOTStatus === 'rejected' ? (
                      <Badge variant="destructive" className="rounded-sm">
                        OT Rejected
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600 rounded-sm">
                        Clocked In
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Since {todayAttendance[0] && format(new Date(todayAttendance[0].timestamp), "HH:mm")}
                    </span>
                  </div>
                  {currentOTStatus === 'pending' && (
                    <p className="text-[10px] text-amber-600 italic">Awaiting admin approval — hours not counted until approved</p>
                  )}
                  {currentOTStatus === 'rejected' && (
                    <p className="text-[10px] text-destructive italic">Overtime was rejected — please clock out</p>
                  )}
                </>
              ) : (
                <Badge variant="secondary" className="rounded-sm">Not Clocked In</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mobile Attendance Control */}
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mobile Attendance</CardTitle>
            <Navigation className={cn("h-4 w-4", nearestOutlet ? "text-primary" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {isLocating ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                    Locating...
                  </div>
                ) : nearestOutlet ? (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <MapPin className="w-3 h-3 text-primary shrink-0" />
                      <span className="text-xs font-medium truncate">{nearestOutlet.outlet.name}</span>
                    </div>
                    <span className={cn(
                      "text-[10px] font-mono",
                      nearestOutlet.distance <= nearestOutlet.outlet.radius_meters 
                        ? "text-green-500" 
                        : "text-destructive"
                    )}>
                      {Math.round(nearestOutlet.distance)}m away (Radius: {nearestOutlet.outlet.radius_meters}m)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="w-3 h-3" />
                    {locationError || "Location Required"}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button 
                  size="sm" 
                  className="h-8 rounded-sm text-[11px]" 
                  disabled={clockedIn || isSubmitting || !nearestOutlet || nearestOutlet.distance > nearestOutlet.outlet.radius_meters}
                  onClick={() => handleClockAction("clock-in")}
                >
                  {isSubmitting ? "..." : "Clock In"}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 rounded-sm text-[11px]" 
                  disabled={!clockedIn || isSubmitting || !nearestOutlet || nearestOutlet.distance > nearestOutlet.outlet.radius_meters}
                  onClick={() => handleClockAction("clock-out")}
                >
                  {isSubmitting ? "..." : "Clock Out"}
                </Button>
              </div>
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
              const todayOT = overtimeRequests.find(r => r.request_date === today && r.is_scheduled && r.status === "approved")
              
              return (
                <div className="flex flex-col gap-3">
                  {todayShift ? (
                    <div className="flex flex-col gap-1 pb-3 lg:pb-0 lg:border-b-0 border-b border-border/50">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">{getShiftDisplayName(todayShift)}</span>
                        <Badge 
                          variant="outline" 
                          className={getShiftType(todayShift) === "Full Time" 
                            ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" 
                            : "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                          }
                        >
                          {getShiftType(todayShift)}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {todayShift.start_time} - {todayShift.end_time}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col pb-3 lg:pb-0 lg:border-b-0 border-b border-border/50">
                      <span className="text-lg font-semibold text-muted-foreground">No Shift</span>
                      <span className="text-xs text-muted-foreground">
                        No shift scheduled for today
                      </span>
                    </div>
                  )}

                  {todayOT && (
                    <div className="flex flex-col gap-1 pt-1 lg:pt-3 lg:border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">Scheduled Overtime</span>
                        <Badge className="bg-blue-500 hover:bg-blue-600 rounded-sm">Approved</Badge>
                      </div>
                      <span className="text-xs font-medium text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 self-start px-2 py-0.5 rounded-sm">
                        From {format(new Date(todayOT.clock_in_time), "HH:mm")} (Limit: {todayOT.approved_overtime_minutes}m)
                      </span>
                    </div>
                  )}
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
                  {(() => {
                    // Process attendance to inject auto-tap-out and calculate durations
                    type ProcessedLog = AttendanceLog & {
                      _isVirtual?: boolean
                      _sessionMinutes?: number
                      _isAutoClockOut?: boolean
                      _isEarlyTapIn?: boolean
                      _shiftStart?: string   // e.g. "14:00"
                      _shiftEnd?: string     // e.g. "22:00"
                    }

                    // Build OT map
                    const otMap = new Map<string, OvertimeRequest>()
                    for (const ot of overtimeRequests) {
                      if (ot.attendance_log_id) otMap.set(ot.attendance_log_id, ot)
                    }

                    // Group logs by date
                    const logsByDate = new Map<string, AttendanceLog[]>()
                    for (const log of myAttendance) {
                      const date = log.date || log.timestamp?.split('T')[0] || ''
                      if (!logsByDate.has(date)) logsByDate.set(date, [])
                      logsByDate.get(date)!.push(log)
                    }

                    const allProcessed: ProcessedLog[] = []

                    for (const [dateStr, dayLogs] of logsByDate) {
                      const sorted = [...dayLogs]
                        .filter(l => l.status !== 'rejected')
                        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                      
                      const shift = myShifts.find(s => s.date === dateStr)

                      let currentIn: AttendanceLog | null = null

                      for (const log of sorted) {
                        const action = log.action || log.type
                        if (action === 'clock-in') {
                          if (currentIn) {
                            // Dangling clock-in, close previous
                            const otReq = otMap.get(currentIn.id)
                            const session = calculateRegulatedSession(currentIn, null, shift, otReq?.status || 'none')
                            if (session.isAutoClockOut && session.clockOut) {
                              allProcessed.push({
                                id: `virtual-${currentIn.id}`,
                                employee_id: currentIn.employee_id,
                                employee_name: currentIn.employee_name,
                                date: currentIn.date,
                                time: new Date(session.clockOut).toTimeString().substring(0, 8),
                                timestamp: session.clockOut,
                                action: 'clock-out',
                                status: 'auto',
                                type: 'clock-out',
                                _isVirtual: true,
                                _isAutoClockOut: true,
                                _sessionMinutes: session.regularMinutes,
                              })
                            }
                          }
                          currentIn = log
                          // Check early tap-in
                          const isEarly = shift && new Date(log.timestamp) < new Date(`${dateStr}T${shift.start_time}`)
                          allProcessed.push({ 
                            ...log, 
                            _isEarlyTapIn: !!isEarly,
                            _shiftStart: shift?.start_time?.substring(0, 5),
                            _shiftEnd: shift?.end_time?.substring(0, 5),
                          })
                        } else if (action === 'clock-out' && currentIn) {
                          const otReq = otMap.get(currentIn.id)
                          const session = calculateRegulatedSession(currentIn, log, shift, otReq?.status || 'none')
                          allProcessed.push({
                            ...log,
                            _sessionMinutes: session.regularMinutes,
                            _isAutoClockOut: session.isAutoClockOut,
                            _shiftStart: shift?.start_time?.substring(0, 5),
                            _shiftEnd: shift?.end_time?.substring(0, 5),
                          })
                          currentIn = null
                        } else {
                          allProcessed.push({ ...log })
                        }
                      }

                      // Handle dangling clock-in at end of day
                      if (currentIn) {
                        const otReq = otMap.get(currentIn.id)
                        const session = calculateRegulatedSession(currentIn, null, shift, otReq?.status || 'none')
                        if (session.isAutoClockOut && session.clockOut) {
                          allProcessed.push({
                            id: `virtual-${currentIn.id}`,
                            employee_id: currentIn.employee_id,
                            employee_name: currentIn.employee_name,
                            date: currentIn.date,
                            time: new Date(session.clockOut).toTimeString().substring(0, 8),
                            timestamp: session.clockOut,
                            action: 'clock-out',
                            status: 'auto',
                            type: 'clock-out',
                            _isVirtual: true,
                            _isAutoClockOut: true,
                            _sessionMinutes: session.regularMinutes,
                          })
                        }
                      }
                    }

                    // Sort newest first, take 20
                    const display = allProcessed
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .slice(0, 20)

                    const fmtMins = (m: number) => {
                      const h = Math.floor(m / 60)
                      const mins = m % 60
                      return `${h}h ${mins}m`
                    }

                    return display.map((log) => {
                      const isClockIn = (log.type === 'clock-in' || log.action === 'clock-in')
                      const isClockOut = (log.type === 'clock-out' || log.action === 'clock-out')
                      return (
                        <div
                          key={log.id}
                          className={cn(
                            "flex items-center justify-between py-2 border-b last:border-0",
                            log._isVirtual && "bg-amber-50/50 dark:bg-amber-950/10 rounded-sm px-2 -mx-2"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {isClockIn ? (
                              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </div>
                            ) : (
                              <div className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center",
                                log._isVirtual 
                                  ? "bg-amber-100 dark:bg-amber-900/30" 
                                  : "bg-orange-100 dark:bg-orange-900/30"
                              )}>
                                <Clock className={cn(
                                  "h-4 w-4",
                                  log._isVirtual 
                                    ? "text-amber-600 dark:text-amber-400" 
                                    : "text-orange-600 dark:text-orange-400"
                                )} />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm capitalize">
                                  {log._isVirtual ? "Clock Out (Auto)" : (log.type || log.action || "clock-in").replace("-", " ")}
                                </p>
                                {log._isVirtual && (
                                  <Badge variant="outline" className="text-[9px] h-3.5 rounded-none border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-1">
                                    ⚡ Auto
                                  </Badge>
                                )}
                                {isClockIn && log._isEarlyTapIn && log._shiftStart && (
                                  <Badge variant="outline" className="text-[9px] h-3.5 rounded-none border-blue-300 text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-1">
                                    Early • Shift {log._shiftStart}
                                  </Badge>
                                )}
                                {isClockOut && log._sessionMinutes != null && (
                                  <Badge variant="outline" className="text-[9px] h-3.5 rounded-none font-mono px-1">
                                    {fmtMins(log._sessionMinutes)}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(log.timestamp || `${log.date}T${log.time}`), "MMM d, yyyy")}
                                {isClockOut && log._shiftStart && log._shiftEnd && (
                                  <span className="ml-1 text-muted-foreground/70">• Shift {log._shiftStart}-{log._shiftEnd}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-mono">
                            {format(new Date(log.timestamp || `${log.date}T${log.time}`), "HH:mm")}
                          </span>
                        </div>
                      )
                    })
                  })()}
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
                {/* Absentee Alerts */}
                {missedShifts.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-500 rounded-lg animate-pulse">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-destructive uppercase tracking-widest text-[10px]">
                          Action Required
                        </p>
                        <p className="font-medium text-red-800 dark:text-red-200 text-sm mt-0.5">
                          Unrecorded Shift(s) Detected
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                          You were scheduled to work on <b>{missedShifts.slice(0,2).map(s => s.date).join(", ")}</b> but no attendance was found. This is marked as ABSENT and subject to salary deduction. Please contact Admin immediately if this is an error.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
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
                const shiftsForDay = myShifts
                  .filter(s => s.date === dateStr)
                  .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
                
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

      {/* Late Records Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Lateness History
          </CardTitle>
          <CardDescription>
            You have been late <b>{lateRecords.length}</b> time(s) so far.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {lateRecords.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {lateRecords.map((late) => (
                  <div
                    key={late.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-orange-50/30 dark:bg-orange-950/20"
                  >
                    <div>
                      <p className="font-medium">{format(new Date(late.date), "MMM d, yyyy")}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {late.shiftName} <span className="text-xs">({late.startTime})</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/50 dark:text-orange-300 font-mono">
                        {late.lateMins}m Late
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        In @ {late.clockInTime}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                <CheckCircle2 className="h-10 w-10 mb-2 opacity-50 text-green-500" />
                <p>Perfect Punctuality!</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Absence History Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Absence History
          </CardTitle>
          <CardDescription>
            You have missed <b>{missedShifts.length}</b> scheduled shift(s).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {missedShifts.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {[...missedShifts]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((absent) => (
                    <div
                      key={absent.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-red-50/30 dark:bg-red-950/20 shadow-sm"
                    >
                      <div>
                        <p className="font-medium">{format(new Date(absent.date), "MMM d, yyyy")}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {getShiftDisplayName(absent)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="destructive" className="font-bold tracking-tighter">
                          ABSENT
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {absent.start_time}-{absent.end_time}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                <CheckCircle2 className="h-10 w-10 mb-2 opacity-50 text-emerald-500" />
                <p>No Missing Shifts. Keep it up!</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Overtime Request Prompt Dialog */}
      <Dialog open={isOTPromptOpen} onOpenChange={setIsOTPromptOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-bold">
              <Clock className="w-5 h-5 text-orange-500" />
              Overtime Required
            </DialogTitle>
            <DialogDescription className="pt-2 text-foreground">
              <p className="font-medium text-destructive mb-2">You are attempting to clock in more than 45 minutes before your shift starts.</p>
              <p className="text-sm">Regular clock-in is only permitted within 45 minutes of your scheduled start time. To clock in now, please submit an **Overtime Request** for admin approval.</p>
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/30 p-3 rounded-sm text-[11px] border border-orange-200 dark:border-orange-950 text-muted-foreground italic">
            Note: All early work must be approved to be counted towards your payroll.
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsOTPromptOpen(false)} className="rounded-sm flex-1">
              Wait for Shift
            </Button>
            <Button 
              onClick={handleMobileOvertimeRequest} 
              disabled={isSubmitting}
              className="rounded-sm flex-1 bg-orange-600 hover:bg-orange-700"
            >
              Request Overtime
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
