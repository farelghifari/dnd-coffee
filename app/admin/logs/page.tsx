"use client"

import { useState, useEffect, useMemo } from "react"
import { parseISO, format, subDays, startOfDay, endOfDay, isSameDay } from "date-fns"
import { 
  getStockLogs, 
  getAttendanceLogs,
  getSystemLogs,
  getSalesLogs,
  getShiftAssignments,
  getOvertimeRequests,
  getOutlets,
  updateAttendanceLogStatus,
  subscribeToInventoryTransactions,
  subscribeToAttendanceLogs,
  subscribeToSystemLogs,
  subscribeToSalesLogs,
  calculateRegulatedSession,
  type StockLog,
  type AttendanceLog,
  type SystemLog,
  type SalesLog,
  type ShiftAssignment,
  type OvertimeRequest,
  type Outlet,
  type DisplayUnit
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
  Package, 
  Users, 
  Search,
  LogIn,
  LogOut,
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  ClipboardList,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Activity,
  UserCog,
  ShieldCheck,
  Settings,
  CalendarDays,
  Coffee,
  ShoppingCart,
  Smartphone,
  Fingerprint,
  MapPin,
  Clock
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function LogsPage() {
  const [stockLogs, setStockLogs] = useState<StockLog[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([])
  const [salesLogs, setSalesLogs] = useState<SalesLog[]>([])
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([])
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<"all" | "in" | "out" | "waste" | "opname">("all")
  
  // Custom Alert/Confirm State
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean,
    title: string,
    description: string,
    onConfirm?: () => void,
    isAlertOnly?: boolean
  }>({ open: false, title: '', description: '' })
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const [stockData, attendanceData, systemData, salesData, shiftData, otData, outletData] = await Promise.all([
        getStockLogs(),
        getAttendanceLogs(),
        getSystemLogs(),
        getSalesLogs(),
        getShiftAssignments(),
        getOvertimeRequests(),
        getOutlets()
      ])
      setStockLogs(stockData)
      setAttendanceLogs(attendanceData)
      setSystemLogs(systemData)
      setSalesLogs(salesData)
      setShiftAssignments(shiftData)
      setOvertimeRequests(otData)
      setOutlets(outletData)
      setIsLoading(false)
    }
    fetchData()
    
    // REALTIME: Subscribe to all log tables for instant auto-refresh
    const unsubStock = subscribeToInventoryTransactions(() => {
      getStockLogs().then(setStockLogs)
    })
    
    const unsubAttendance = subscribeToAttendanceLogs(() => {
      getAttendanceLogs().then(setAttendanceLogs)
    })
    
    const unsubSystem = subscribeToSystemLogs(() => {
      getSystemLogs().then(setSystemLogs)
    })
    
    const unsubSales = subscribeToSalesLogs(() => {
      getSalesLogs().then(setSalesLogs)
    })
    
    return () => {
      unsubStock()
      unsubAttendance()
      unsubSystem()
      unsubSales()
    }
  }, [])

  // Format price in IDR (Rupiah) - no decimals
  const formatPrice = (price: number | undefined | null) => {
    if (price == null || isNaN(price)) return "Rp 0"
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const parseSafeISO = (dateStr: string | undefined | null) => {
    if (!dateStr) return new Date(NaN)
    const normalized = (dateStr.includes('Z') || dateStr.includes('+')) ? dateStr : `${dateStr.replace(' ', 'T')}Z`
    return parseISO(normalized)
  }

  const safeFormatTime = (dateStr: string | undefined | null) => {
    if (!dateStr) return "--:--"
    const d = parseSafeISO(dateStr)
    if (isNaN(d.getTime())) return "--:--"
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  }

  const safeFormatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return "Unknown Date"
    const d = parseSafeISO(dateStr)
    if (isNaN(d.getTime())) return "Unknown Date"
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  // Filter stock logs by date and other criteria
  const filteredStockLogs = useMemo(() => {
    return stockLogs.filter((log) => {
      const logDate = parseSafeISO(log.timestamp)
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const logDateStr = format(logDate, 'yyyy-MM-dd')
      
      const matchesSearch = (log.item_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.employee_name || "").toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = selectedType === "all" || (log.type || "").toLowerCase() === selectedType.toLowerCase()
      const matchesDate = logDateStr === dateStr
      
      return matchesSearch && matchesType && matchesDate
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [stockLogs, selectedDate, searchQuery, selectedType])

  // Build processed attendance logs with auto-tap-out injection and regulated durations
  // This matches the same logic used in the Attendance Report page
  type ProcessedAttendanceLog = AttendanceLog & {
    _isVirtual?: boolean       // true = system-generated auto tap out
    _sessionMinutes?: number   // regulated session minutes
    _regularMinutes?: number   // regulated regular minutes
    _overtimeMinutes?: number  // regulated overtime minutes (only if approved)
    _dailyRegular?: number     // total regular mins for the day
    _dailyOvertime?: number    // total approved OT mins for the day
    _isLate?: boolean
    _lateMinutes?: number
    _isPenalty?: boolean
    _isAutoClockOut?: boolean
  }

  const processedAttendanceLogs = useMemo((): ProcessedAttendanceLog[] => {
    const dateStart = startOfDay(selectedDate)
    const dateEnd = endOfDay(selectedDate)
    const dateStr = format(selectedDate, 'yyyy-MM-dd')

    // Filter real logs for the selected date
    const dayLogs = attendanceLogs.filter((log) => {
      const logDate = parseSafeISO(log.timestamp)
      return logDate >= dateStart && logDate <= dateEnd
    })

    // Group by employee
    const empGroups = new Map<string, AttendanceLog[]>()
    for (const log of dayLogs) {
      if (log.status === 'rejected') continue
      const key = log.employee_id
      if (!empGroups.has(key)) empGroups.set(key, [])
      empGroups.get(key)!.push(log)
    }

    // Build OT map (attendance_log_id -> OvertimeRequest)
    const otMap = new Map<string, OvertimeRequest>()
    for (const ot of overtimeRequests) {
      if (ot.attendance_log_id) otMap.set(ot.attendance_log_id, ot)
    }

    // Find shift for employee on this date
    const getShiftForEmployee = (empId: string): ShiftAssignment | undefined => {
      return shiftAssignments.find(s => s.employee_id === empId && s.date === dateStr)
    }

    const result: ProcessedAttendanceLog[] = []

    for (const [empId, logs] of empGroups) {
      const sorted = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const shift = getShiftForEmployee(empId)

      let totalRegular = 0
      let totalOvertime = 0

      // Pair clock-ins with clock-outs
      let currentIn: AttendanceLog | null = null
      const sessions: { inLog: AttendanceLog; outLog: AttendanceLog | null; session: ReturnType<typeof calculateRegulatedSession> }[] = []

      for (const log of sorted) {
        const action = log.action || log.type
        if (action === 'clock-in') {
          // If there was a previous unpaired clock-in, close it
          if (currentIn) {
            const otReq = otMap.get(currentIn.id)
            const otStatus = otReq?.status || 'none'
            const session = calculateRegulatedSession(currentIn, null, shift, otStatus)
            sessions.push({ inLog: currentIn, outLog: null, session })
          }
          currentIn = log
        } else if (action === 'clock-out' && currentIn) {
          const otReq = otMap.get(currentIn.id)
          const otStatus = otReq?.status || 'none'
          const session = calculateRegulatedSession(currentIn, log, shift, otStatus)
          sessions.push({ inLog: currentIn, outLog: log, session })
          currentIn = null
        }
      }

      // Handle dangling clock-in (no clock-out)
      if (currentIn) {
        const otReq = otMap.get(currentIn.id)
        const otStatus = otReq?.status || 'none'
        const session = calculateRegulatedSession(currentIn, null, shift, otStatus)
        sessions.push({ inLog: currentIn, outLog: null, session })
      }

      // Calculate daily totals
      for (const s of sessions) {
        totalRegular += s.session.regularMinutes
        totalOvertime += s.session.overtimeMinutes
      }
      // Rule 1: Max 8 hours regular per day
      totalRegular = Math.min(totalRegular, 480)

      // Now produce the final log entries for display
      for (const s of sessions) {
        // Add the clock-in log
        result.push({
          ...s.inLog,
          _isLate: s.session.isLate,
          _lateMinutes: s.session.lateMinutes,
          _isPenalty: s.session.isPenalty,
        })

        if (s.outLog) {
          // Real clock-out exists
          result.push({
            ...s.outLog,
            _sessionMinutes: s.session.regularMinutes,
            _regularMinutes: s.session.regularMinutes,
            _overtimeMinutes: s.session.overtimeMinutes,
            _dailyRegular: totalRegular,
            _dailyOvertime: totalOvertime,
            _isAutoClockOut: s.session.isAutoClockOut,
          })
        } else if (s.session.isAutoClockOut && s.session.clockOut) {
          // No real clock-out but system auto-tapped out -> inject virtual log
          const virtualLog: ProcessedAttendanceLog = {
            id: `virtual-${s.inLog.id}`,
            employee_id: s.inLog.employee_id,
            employee_name: s.inLog.employee_name,
            date: s.inLog.date,
            time: new Date(s.session.clockOut).toTimeString().substring(0, 8),
            timestamp: s.session.clockOut,
            action: 'clock-out',
            status: 'auto',
            type: 'clock-out',
            _isVirtual: true,
            _isAutoClockOut: true,
            _sessionMinutes: s.session.regularMinutes,
            _regularMinutes: s.session.regularMinutes,
            _overtimeMinutes: s.session.overtimeMinutes,
            _dailyRegular: totalRegular,
            _dailyOvertime: totalOvertime,
          }
          result.push(virtualLog)
        }
      }
    }

    // Also include rejected logs for display (with opacity)
    const rejectedLogs = dayLogs.filter(l => l.status === 'rejected')
    for (const log of rejectedLogs) {
      result.push(log)
    }

    // Filter by search
    const filtered = result.filter(log => {
      const matchesSearch = (log.employee_name || "").toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSearch
    })

    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [attendanceLogs, shiftAssignments, overtimeRequests, selectedDate, searchQuery])

  // Helper to format minutes into "Xh Ym"
  const formatMinutes = (mins: number): string => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    setConfirmModal({
      open: true,
      title: "Confirm Status Update",
      description: `Are you sure you want to mark this entry as ${status}?`,
      onConfirm: async () => {
        const success = await updateAttendanceLogStatus(id, status)
        if (success) {
          setAttendanceLogs(prev => prev.map(l => l.id === id ? { ...l, status } : l))
        } else {
          setTimeout(() => {
            setConfirmModal({
              open: true,
              title: "Update Failed",
              description: "There was an error updating the attendance status.",
              isAlertOnly: true
            })
          }, 100)
        }
      }
    })
  }

  // Filter sales/menu logs by date
  const filteredSalesLogs = useMemo(() => {
    return salesLogs.filter((log) => {
      const logDate = parseSafeISO(log.created_at)
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const logDateStr = format(logDate, 'yyyy-MM-dd')
      
      const matchesDate = logDateStr === dateStr
      const matchesSearch = (log.menu_name || "").toLowerCase().includes(searchQuery.toLowerCase())
      
      return matchesDate && matchesSearch
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [salesLogs, selectedDate, searchQuery])

  // Sales summary for selected date
  const salesSummary = useMemo(() => {
    const totalQty = filteredSalesLogs.reduce((sum, log) => sum + log.quantity, 0)
    const totalRevenue = filteredSalesLogs.reduce((sum, log) => sum + log.total_price, 0)
    return { totalQty, totalRevenue }
  }, [filteredSalesLogs])

  // Filter system logs by date and search
  const filteredSystemLogs = useMemo(() => {
    return systemLogs.filter((log) => {
      const logDate = parseSafeISO(log.timestamp)
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const logDateStr = format(logDate, 'yyyy-MM-dd')
      
      const matchesDate = logDateStr === dateStr
      const matchesSearch = (log.actor || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.target || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.details || "").toLowerCase().includes(searchQuery.toLowerCase())
      
      return matchesDate && matchesSearch
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [systemLogs, selectedDate, searchQuery])

  // Get icon for system log action
  const getSystemLogIcon = (action: SystemLog['action']) => {
    switch (action) {
      case "inventory_change": return <Package className="w-4 h-4 text-blue-500" />
      case "employee_update": return <UserCog className="w-4 h-4 text-green-500" />
      case "role_change": return <ShieldCheck className="w-4 h-4 text-purple-500" />
      case "settings_change": return <Settings className="w-4 h-4 text-gray-500" />
      case "shift_change": return <CalendarDays className="w-4 h-4 text-orange-500" />
      case "overtime_action": return <Clock className="w-4 h-4 text-yellow-500" />
      case "menu_change": return <Coffee className="w-4 h-4 text-rose-500" />
      case "kpi_change": return <Activity className="w-4 h-4 text-cyan-500" />
      default: return <Activity className="w-4 h-4 text-muted-foreground" />
    }
  }

  // Get badge for system log action
  const getSystemLogBadge = (action: SystemLog['action']) => {
    const styles: Record<string, string> = {
      inventory_change: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
      employee_update: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300",
      role_change: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
      settings_change: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
      shift_change: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
      overtime_action: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300",
      menu_change: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300",
      kpi_change: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300"
    }
    const labels: Record<string, string> = {
      inventory_change: "Inventory",
      employee_update: "Employee",
      role_change: "Role",
      settings_change: "Settings",
      shift_change: "Shift",
      overtime_action: "Overtime",
      menu_change: "Menu",
      kpi_change: "KPI/Performance"
    }
    return (
      <Badge variant="outline" className={cn("rounded-sm capitalize text-xs", styles[action] || "")}>
        {labels[action] || action}
      </Badge>
    )
  }

  const goToPreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1))
  }

  const goToNextDay = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (selectedDate < tomorrow) {
      setSelectedDate(prev => {
        const next = new Date(prev)
        next.setDate(next.getDate() + 1)
        return next
      })
    }
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  const isToday = isSameDay(selectedDate, new Date())

  const getTypeIcon = (type: StockLog["type"]) => {
    switch (type) {
      case "in": return <ArrowUpCircle className="w-4 h-4 text-[var(--status-healthy)]" />
      case "out": return <ArrowDownCircle className="w-4 h-4 text-muted-foreground" />
      case "waste": return <Trash2 className="w-4 h-4 text-[var(--status-critical)]" />
      case "opname": return <ClipboardList className="w-4 h-4 text-[var(--status-warning)]" />
    }
  }

  const getTypeBadge = (type: StockLog["type"]) => {
    const styles = {
      in: "bg-[var(--status-healthy)]/10 text-[var(--status-healthy)] border-[var(--status-healthy)]/20",
      out: "bg-muted text-muted-foreground border-border",
      waste: "bg-[var(--status-critical)]/10 text-[var(--status-critical)] border-[var(--status-critical)]/20",
      opname: "bg-[var(--status-warning)]/10 text-[var(--status-warning)] border-[var(--status-warning)]/20",
    }
    const labels = { in: "Stock In", out: "Stock Out", waste: "Waste", opname: "Opname" }
    return (
      <Badge variant="outline" className={cn("rounded-sm capitalize", styles[type])}>
        {labels[type]}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-light tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground">Stock movements, attendance, menu sales, and system records</p>
      </header>

      {/* Date Navigation */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-sm h-9 w-9"
            onClick={goToPreviousDay}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="rounded-sm min-w-[200px] justify-start">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {format(selectedDate, "EEEE, MMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-sm" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date)
                    setIsCalendarOpen(false)
                  }
                }}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-sm h-9 w-9"
            onClick={goToNextDay}
            disabled={isToday}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        {!isToday && (
          <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs">
            Go to Today
          </Button>
        )}
      </div>

      <Tabs defaultValue="stock" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList className="rounded-sm">
            <TabsTrigger value="stock" className="rounded-sm">
              <Package className="w-4 h-4 mr-2" />
              Stock Logs
            </TabsTrigger>
            <TabsTrigger value="attendance" className="rounded-sm">
              <Users className="w-4 h-4 mr-2" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="menu" className="rounded-sm">
              <Coffee className="w-4 h-4 mr-2" />
              Menu
            </TabsTrigger>
            <TabsTrigger value="system" className="rounded-sm">
              <Activity className="w-4 h-4 mr-2" />
              System
            </TabsTrigger>
          </TabsList>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-sm"
            />
          </div>
        </div>

        <TabsContent value="stock">
          {/* Type Filters */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
            {(["all", "in", "out", "waste", "opname"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={cn(
                  "px-4 py-1.5 rounded-sm text-sm capitalize whitespace-nowrap transition-colors",
                  selectedType === type
                    ? "bg-foreground text-background"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {type === "all" ? "All Types" : type === "opname" ? "Stock Opname" : `Stock ${type.charAt(0).toUpperCase() + type.slice(1)}`}
              </button>
            ))}
          </div>

          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Stock Movement Logs ({filteredStockLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredStockLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No stock logs found for this date</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {filteredStockLogs.map((log) => (
                    <div 
                      key={log.id}
                      className="flex items-center justify-between p-4 rounded-sm border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-sm bg-muted flex items-center justify-center">
                          {getTypeIcon(log.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{log.item_name}</p>
                            {getTypeBadge(log.type)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {log.type === "in" ? "+" : log.type === "waste" ? "-" : ""}{log.amount} {log.unit || 'units'} by {log.employee_name}
                          </p>
                          {log.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              &quot;{log.notes}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono">
                          {safeFormatTime(log.timestamp)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {safeFormatDate(log.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Attendance Logs ({processedAttendanceLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {processedAttendanceLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No attendance logs found for this date</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {processedAttendanceLogs.map((log) => {
                    const isClockIn = (log.type === "clock-in" || log.action === "clock-in")
                    const isClockOut = (log.type === "clock-out" || log.action === "clock-out")
                    const pLog = log as any // ProcessedAttendanceLog fields
                    return (
                      <div 
                        key={log.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-sm border transition-colors",
                          log.status === "rejected" ? "border-destructive/30 bg-destructive/5 opacity-70" : 
                          pLog._isVirtual ? "border-amber-300/50 bg-amber-50/30 dark:bg-amber-950/10" :
                          "border-border hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-sm flex items-center justify-center",
                            isClockIn
                              ? "bg-[var(--status-healthy)]/10" 
                              : pLog._isVirtual ? "bg-amber-100 dark:bg-amber-900/30"
                              : "bg-muted"
                          )}>
                            {isClockIn
                              ? <LogIn className={cn("w-5 h-5", log.status === "rejected" ? "text-muted-foreground" : "text-[var(--status-healthy)]")} />
                              : <LogOut className={cn("w-5 h-5", pLog._isVirtual ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
                            }
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-lg leading-none">{log.employee_name || "Unknown"}</p>
                              <div className="flex items-center gap-1.5 ml-2">
                                {log.method === 'personal' ? (
                                  <Badge className="bg-primary/10 text-primary border-primary/20 flex gap-1 items-center px-1.5 h-5 rounded-sm">
                                    <Smartphone className="w-3 h-3" />
                                    <span className="text-[10px] font-bold uppercase">Mobile</span>
                                  </Badge>
                                ) : (
                                  <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 flex gap-1 items-center px-1.5 h-5 rounded-sm">
                                    <Fingerprint className="w-3 h-3" />
                                    <span className="text-[10px] font-bold uppercase">OPS NFC</span>
                                  </Badge>
                                )}
                                {log.outlet_id && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <MapPin className="w-2.5 h-2.5" />
                                    {outlets.find(o => o.id === log.outlet_id)?.name || `Loc: ${log.outlet_id.substring(0,8)}`}
                                  </span>
                                )}
                              </div>
                              {log.status === "rejected" ? (
                                <Badge variant="destructive" className="text-[10px] h-4 rounded-none uppercase">REJECTED</Badge>
                              ) : log.status === "approved" ? (
                                <Badge className="bg-[var(--status-healthy)] text-white text-[10px] h-4 rounded-none uppercase">APPROVED</Badge>
                              ) : null}
                              {pLog._isVirtual && (
                                <Badge variant="outline" className="text-[10px] h-4 rounded-none uppercase border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20">
                                  ⚡ System Auto-Tap
                                </Badge>
                              )}
                              {pLog._isLate && isClockIn && (
                                <Badge variant="outline" className={cn(
                                  "text-[10px] h-4 rounded-none uppercase",
                                  pLog._isPenalty 
                                    ? "border-red-400 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20" 
                                    : "border-yellow-400 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20"
                                )}>
                                  {pLog._isPenalty ? "⚠ LATE" : "LATE"} {pLog._lateMinutes}m
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <p className="text-sm text-muted-foreground capitalize">
                                {pLog._isVirtual ? "Clock Out (Auto)" : ((log.type || log.action) || "").replace("-", " ")}
                              </p>
                              {isClockOut && pLog._sessionMinutes != null && (
                                <Badge variant="outline" className="text-[10px] h-4 rounded-none flex gap-1 items-center font-mono">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatMinutes(pLog._sessionMinutes)}
                                </Badge>
                              )}
                              {isClockOut && pLog._dailyRegular != null && (
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] h-4 rounded-none flex gap-1 items-center font-mono"
                                >
                                  Total: {formatMinutes(pLog._dailyRegular)}
                                </Badge>
                              )}
                              {isClockOut && pLog._dailyOvertime != null && pLog._dailyOvertime > 0 && (
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] h-4 rounded-none flex gap-1 items-center font-mono border-[var(--status-warning)] text-[var(--status-warning)]"
                                >
                                  OT: {formatMinutes(pLog._dailyOvertime)} ✓
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm font-mono font-medium">
                              {safeFormatTime(log.timestamp)}
                            </p>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">
                              {safeFormatDate(log.timestamp)}
                            </p>
                          </div>
                          
                          {log.status !== "rejected" && !pLog._isVirtual && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleUpdateStatus(log.id, "rejected")}
                              title="Reject/Void this entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NEW: Menu / Sales Logs Tab */}
        <TabsContent value="menu">
          {/* Summary bar */}
          {filteredSalesLogs.length > 0 && (
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-sm bg-muted">
                <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{salesSummary.totalQty} items sold</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-sm bg-muted">
                <span className="text-sm font-medium">{formatPrice(salesSummary.totalRevenue)}</span>
              </div>
            </div>
          )}

          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coffee className="w-5 h-5" />
                Menu Sales Logs ({filteredSalesLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredSalesLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Coffee className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No menu sales found for this date</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {filteredSalesLogs.map((log) => (
                    <div 
                      key={log.id}
                      className="flex items-center justify-between p-4 rounded-sm border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-sm bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                          <Coffee className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{log.menu_name || "Unknown"}</p>
                            <Badge variant="outline" className="rounded-sm text-xs bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300">
                              Sale
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {log.quantity}x &middot; {formatPrice(log.total_price)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono font-medium">
                          {safeFormatTime(log.created_at)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {safeFormatDate(log.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                System Activity Logs ({filteredSystemLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredSystemLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No system activity logs found for this date</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {filteredSystemLogs.map((log) => (
                    <div 
                      key={log.id}
                      className="flex items-center justify-between p-4 rounded-sm border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-sm bg-muted flex items-center justify-center">
                          {getSystemLogIcon(log.action)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{log.target || "System"}</p>
                            {getSystemLogBadge(log.action)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {log.details || "No details"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            by {log.actor || "System"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono">
                          {safeFormatTime(log.timestamp)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {safeFormatDate(log.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* Global Alert/Confirm Dialog */}
      <AlertDialog open={confirmModal.open} onOpenChange={(open) => setConfirmModal(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmModal.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmModal.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {!confirmModal.isAlertOnly && (
              <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            )}
            <AlertDialogAction 
              className="rounded-sm" 
              onClick={() => {
                if (confirmModal.onConfirm) confirmModal.onConfirm()
                setConfirmModal(prev => ({ ...prev, open: false }))
              }}
            >
              {confirmModal.isAlertOnly ? "OK" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
