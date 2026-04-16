"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  getStockLogs, 
  getAttendanceLogs,
  getSystemLogs,
  updateAttendanceLogStatus,
  getDailyWorkDuration,
  type StockLog,
  type AttendanceLog,
  type SystemLog
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
  Clock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, subDays, startOfDay, endOfDay, isSameDay, differenceInMinutes } from "date-fns"

export default function LogsPage() {
  const [stockLogs, setStockLogs] = useState<StockLog[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<"all" | "in" | "out" | "waste" | "opname">("all")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async (isSilent = false) => {
      if (!isSilent) setIsLoading(true)
      const [stockData, attendanceData, systemData] = await Promise.all([
        getStockLogs(),
        getAttendanceLogs(),
        getSystemLogs()
      ])
      setStockLogs(stockData)
      setAttendanceLogs(attendanceData)
      setSystemLogs(systemData)
      if (!isSilent) setIsLoading(false)
    }
    fetchData()
    
    // Refresh data every 10 seconds for real-time sync (silent)
    const interval = setInterval(() => fetchData(true), 10000)
    return () => clearInterval(interval)
  }, [])

  // Filter stock logs by date and other criteria
  const filteredStockLogs = useMemo(() => {
    return stockLogs.filter((log) => {
      const logDate = new Date(log.timestamp)
      const dateStart = startOfDay(selectedDate)
      const dateEnd = endOfDay(selectedDate)
      
      const matchesDate = logDate >= dateStart && logDate <= dateEnd
      const matchesSearch = (log.item_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.employee_name || "").toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = selectedType === "all" || log.type === selectedType
      
      return matchesDate && matchesSearch && matchesType
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [stockLogs, selectedDate, searchQuery, selectedType])

  // Filter attendance logs by date
  const filteredAttendanceLogs = useMemo(() => {
    return attendanceLogs.filter((log) => {
      const logDate = new Date(log.timestamp)
      const dateStart = startOfDay(selectedDate)
      const dateEnd = endOfDay(selectedDate)
      
      const matchesDate = logDate >= dateStart && logDate <= dateEnd
      const matchesSearch = (log.employee_name || "").toLowerCase().includes(searchQuery.toLowerCase())
      
      return matchesDate && matchesSearch
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [attendanceLogs, selectedDate, searchQuery])

  // Helper to calculate shift duration from clock-in to clock-out
  const getShiftDuration = (log: AttendanceLog): { session: string | null; daily: string | null; isOvertime: boolean } => {
    const isClockOut = log.type === "clock-out" || log.action === "clock-out"
    if (!isClockOut) return { session: null, daily: null, isOvertime: false }
    
    // Find the closest clock-in BEFORE this clock-out for the same employee
    const empLogs = attendanceLogs
      .filter(l => l.employee_id === log.employee_id && l.status !== 'rejected')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    
    const currentIndex = empLogs.findIndex(l => l.id === log.id)
    if (currentIndex <= 0) return { session: null, daily: null, isOvertime: false }
    
    // Calculate THIS session duration (from preceding clock-in)
    let sessionStr: string | null = null
    const prevLog = empLogs[currentIndex - 1]
    if (prevLog.type === "clock-in" || prevLog.action === "clock-in") {
      const minutes = differenceInMinutes(new Date(log.timestamp), new Date(prevLog.timestamp))
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      sessionStr = `${hours}h ${mins}m`
    }
    
    // Calculate DAILY total by summing all completed sessions for this employee on this date
    const logDate = log.timestamp.split('T')[0]
    const dayLogs = empLogs.filter(l => l.timestamp.startsWith(logDate))
    let totalDailyMinutes = 0
    let clockInTime: Date | null = null
    
    for (const dl of dayLogs) {
      const action = dl.action || dl.type
      if (action === 'clock-in') {
        clockInTime = new Date(dl.timestamp)
      } else if (action === 'clock-out' && clockInTime) {
        totalDailyMinutes += differenceInMinutes(new Date(dl.timestamp), clockInTime)
        clockInTime = null
      }
    }
    
    const dailyHours = Math.floor(totalDailyMinutes / 60)
    const dailyMins = totalDailyMinutes % 60
    const dailyStr = `${dailyHours}h ${dailyMins}m`
    const isOvertime = totalDailyMinutes > 480 // > 8 hours
    
    return { session: sessionStr, daily: dailyStr, isOvertime }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    if (!confirm(`Mark this entry as ${status}?`)) return
    const success = await updateAttendanceLogStatus(id, status)
    if (success) {
      // Refresh local state or rely on the 10s interval
      setAttendanceLogs(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    } else {
      alert("Failed to update status")
    }
  }

  // Filter system logs by date and search
  const filteredSystemLogs = useMemo(() => {
    return systemLogs.filter((log) => {
      const logDate = new Date(log.timestamp)
      const dateStart = startOfDay(selectedDate)
      const dateEnd = endOfDay(selectedDate)
      
      const matchesDate = logDate >= dateStart && logDate <= dateEnd
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
      overtime_action: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300"
    }
    const labels: Record<string, string> = {
      inventory_change: "Inventory",
      employee_update: "Employee",
      role_change: "Role",
      settings_change: "Settings",
      shift_change: "Shift",
      overtime_action: "Overtime"
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
        <p className="text-muted-foreground">Stock movements and attendance records</p>
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
                            {log.type === "in" ? "+" : log.type === "waste" ? "-" : ""}{log.amount} units by {log.employee_name}
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
                          {new Date(log.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric"
                          })}
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
                Attendance Logs ({filteredAttendanceLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredAttendanceLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No attendance logs found for this date</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {filteredAttendanceLogs.map((log) => {
                    const duration = getShiftDuration(log)
                    return (
                      <div 
                        key={log.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-sm border transition-colors",
                          log.status === "rejected" ? "border-destructive/30 bg-destructive/5 opacity-70" : "border-border hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-sm flex items-center justify-center",
                            (log.type === "clock-in" || log.action === "clock-in")
                              ? "bg-[var(--status-healthy)]/10" 
                              : "bg-muted"
                          )}>
                            {(log.type === "clock-in" || log.action === "clock-in")
                              ? <LogIn className={cn("w-5 h-5", log.status === "rejected" ? "text-muted-foreground" : "text-[var(--status-healthy)]")} />
                              : <LogOut className="w-5 h-5 text-muted-foreground" />
                            }
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-lg leading-none">{log.employee_name || "Unknown"}</p>
                              {log.status === "rejected" ? (
                                <Badge variant="destructive" className="text-[10px] h-4 rounded-none uppercase">REJECTED</Badge>
                              ) : log.status === "approved" ? (
                                <Badge className="bg-[var(--status-healthy)] text-white text-[10px] h-4 rounded-none uppercase">APPROVED</Badge>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-muted-foreground capitalize">
                                {((log.type || log.action) || "").replace("-", " ")}
                              </p>
                              {duration.session && (
                                <Badge variant="outline" className="text-[10px] h-4 rounded-none flex gap-1 items-center font-mono">
                                  <Clock className="w-2.5 h-2.5" />
                                  {duration.session}
                                </Badge>
                              )}
                              {duration.daily && (
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-[10px] h-4 rounded-none flex gap-1 items-center font-mono",
                                    duration.isOvertime && "border-[var(--status-warning)] text-[var(--status-warning)]"
                                  )}
                                >
                                  Total: {duration.daily}
                                  {duration.isOvertime && " ⚠️ OT"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm font-mono font-medium">
                              {new Date(log.timestamp).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">
                              {new Date(log.timestamp).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric"
                              })}
                            </p>
                          </div>
                          
                          {log.status !== "rejected" && (
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
                          {new Date(log.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric"
                          })}
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
    </div>
  )
}
