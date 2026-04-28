"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  getAttendanceReportData,
  getEmployees,
  getShiftAssignments,
  addAttendanceLog,
  getOutlets,
  type Employee,
  type ShiftAssignment,
  type Outlet
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  ShieldAlert,
  Timer as TimerIcon,
  Smartphone,
  Fingerprint,
  Info,
  Users,
  CalendarIcon,
  Clock,
  Search,
  AlertTriangle,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, startOfMonth, endOfMonth, isSameDay, subDays, addDays, parseISO } from "date-fns"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UserPlus, UserMinus, HardDrive, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"

export default function AttendanceReportPage() {
  const { isSuperAdmin } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [reportData, setReportData] = useState<any[]>([])
  const [shifts, setShifts] = useState<ShiftAssignment[]>([])
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [outlets, setOutlets] = useState<Outlet[]>([])
  
  // Resolve Absent Modal State
  const [resolveModalOpen, setResolveModalOpen] = useState(false)
  const [resolveData, setResolveData] = useState<{ employee_id: string; employee_name: string; date: string } | null>(null)
  const [resolveTimes, setResolveTimes] = useState({ clockIn: "08:00", clockOut: "17:00" })
  const [isResolving, setIsResolving] = useState(false)
  
  // Manual Attendance Modal State
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [manualData, setManualData] = useState({
    employeeId: "",
    type: "clock-in" as "clock-in" | "clock-out",
    date: format(new Date(), "yyyy-MM-dd"),
    time: format(new Date(), "HH:mm")
  })
  const [isManualLoading, setIsManualLoading] = useState(false)

  const refreshReport = async (silent = false) => {
    if (!silent) setIsLoading(true)
    const data = await getAttendanceReportData(
      format(dateRange.from, "yyyy-MM-dd"),
      format(dateRange.to, "yyyy-MM-dd")
    )
    setReportData(data)
    if (!silent) setIsLoading(false)
  }

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const [empData, shiftData, initialReport, outletsData] = await Promise.all([
        getEmployees(),
        getShiftAssignments(),
        getAttendanceReportData(
          format(dateRange.from, "yyyy-MM-dd"),
          format(dateRange.to, "yyyy-MM-dd")
        ),
        getOutlets()
      ])
      setEmployees(empData)
      setShifts(shiftData)
      setReportData(initialReport)
      setOutlets(outletsData)
      setIsLoading(false)
    }
    fetchData()
  }, [])

  // Auto-refresh active session durations every 15 seconds (silent)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshReport(true)
    }, 15000)
    return () => clearInterval(interval)
  })


  // Helper to parse YYYY-MM-DD to local Date without UTC shifting
  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  
  const handleResolveAbsent = async () => {
    if (!resolveData) return
    setIsResolving(true)
    
    // Add manual clock in
    await addAttendanceLog({
      employee_id: resolveData.employee_id,
      employee_name: resolveData.employee_name,
      type: "clock-in",
      manual_date: resolveData.date,
      manual_time: `${resolveTimes.clockIn}:00`
    })
    
    // Add manual clock out
    await addAttendanceLog({
      employee_id: resolveData.employee_id,
      employee_name: resolveData.employee_name,
      type: "clock-out",
      manual_date: resolveData.date,
      manual_time: `${resolveTimes.clockOut}:00`
    })
    
    setResolveModalOpen(false)
    setResolveData(null)
    setIsResolving(false)
    await refreshReport()
  }

  const handleManualAction = async () => {
    if (!manualData.employeeId) {
      toast.error("Please select a barista")
      return
    }

    const employee = employees.find(e => e.id === manualData.employeeId)
    if (!employee) return

    setIsManualLoading(true)
    try {
      await addAttendanceLog({
        employee_id: manualData.employeeId,
        employee_name: employee.name,
        type: manualData.type,
        manual_date: manualData.date,
        manual_time: `${manualData.time}:00`,
        method: 'nfc', // Treat admin manual action as system-level
        is_ops_device: true
      })
      
      toast.success(`Successfully ${manualData.type === 'clock-in' ? 'clocked in' : 'clocked out'} ${employee.name}`)
      setManualModalOpen(false)
      await refreshReport()
    } catch (error) {
      console.error(error)
      toast.error("Failed to process manual action")
    } finally {
      setIsManualLoading(false)
    }
  }

  const triggerForceClockOut = (employeeId: string, employeeName: string, date: string) => {
    setManualData({
      employeeId,
      type: "clock-out",
      date,
      time: format(new Date(), "HH:mm")
    })
    setManualModalOpen(true)
  }

  const filteredReport = useMemo(() => {
    return [...reportData]
      .filter(r => r.employee_name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        // First sort by date descending
        const dateCompare = b.date.localeCompare(a.date)
        if (dateCompare !== 0) return dateCompare
        
        // Then sort by latest session time if available
        const aTime = a.sessions?.[0]?.clockIn || "00:00"
        const bTime = b.sessions?.[0]?.clockIn || "00:00"
        return bTime.localeCompare(aTime)
      })
  }, [reportData, searchQuery])

  // Rule 6: Stats for the summary cards
  const summaryStats = useMemo(() => {
    const stats = {
      totalHours: 0,
      totalOT: 0,
      lateCount: 0,
      penaltyCount: 0,
      absentCount: 0
    }
    
    filteredReport.forEach(r => {
      if (r.isAbsent) {
        stats.absentCount++
      } else {
        stats.totalHours += r.regularMinutes / 60
        stats.totalOT += r.overtimeMinutes / 60
        if (r.isLate) stats.lateCount++
        if (r.isPenalty) stats.penaltyCount++
      }
    })
    
    return stats
  }, [filteredReport])

  // Get assigned shift for a specific report row
  const getAssignedShift = (employeeId: string, date: string) => {
    return shifts.find(s => s.employee_id === employeeId && s.date === date)
  }

  const formatHours = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    return `${h}h ${m}m`
  }

  if (isLoading && reportData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-foreground">Attendance Report</h1>
          <p className="text-muted-foreground">Monitor performance and calculate work hours for salary evaluations</p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin() && (
            <Button 
              variant="outline" 
              className="rounded-sm gap-2 border-primary/20 text-primary hover:bg-primary/5"
              onClick={() => {
                setManualData({
                  employeeId: "",
                  type: "clock-in",
                  date: format(new Date(), "yyyy-MM-dd"),
                  time: format(new Date(), "HH:mm")
                })
                setManualModalOpen(true)
              }}
            >
              <ShieldCheck className="w-4 h-4" />
              Manual Action
            </Button>
          )}
          <Button variant="outline" className="rounded-sm gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </header>

      {/* Summary Stats Cards - Rule 6 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-sm border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Work Hours</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalHours.toFixed(1)}h</div>
            <p className="text-[10px] text-muted-foreground mt-1">Regular hours across period</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-sm border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Overtime</CardTitle>
            <TimerIcon className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{summaryStats.totalOT.toFixed(1)}h</div>
            <p className="text-[10px] text-muted-foreground mt-1 text-amber-600/70 italic">Approved sessions only</p>
          </CardContent>
        </Card>

        <Card className="rounded-sm border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lateness Count</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.lateCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Total late arrivals</p>
          </CardContent>
        </Card>

        <Card className="rounded-sm border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Absences</CardTitle>
            <ShieldAlert className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summaryStats.absentCount}</div>
            <p className="text-[10px] text-destructive/70 mt-1 font-bold">Scheduled but no clock-in</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="rounded-sm border-border shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-5 grid gap-2">
              <label className="text-sm font-medium">Period Selection</label>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-left font-normal rounded-sm">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.from, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-sm" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground shrink-0">—</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-left font-normal rounded-sm">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.to, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-sm" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="lg:col-span-4 grid gap-2">
              <label className="text-sm font-medium">Search Barista</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Name..."
                  className="pl-9 rounded-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="lg:col-span-3">
              <Button 
                className="w-full rounded-sm gap-2 bg-foreground text-background hover:bg-foreground/90"
                onClick={() => refreshReport()}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Generate Report"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resolve Absent Modal */}
      <Dialog open={resolveModalOpen} onOpenChange={setResolveModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Resolve Absent Status</DialogTitle>
            <DialogDescription>
              Manually insert clock-in and clock-out logs for {resolveData?.employee_name} on {resolveData?.date}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="clockIn" className="text-right">
                Clock In
              </Label>
              <Input
                id="clockIn"
                type="time"
                className="col-span-3"
                value={resolveTimes.clockIn}
                onChange={(e) => setResolveTimes({...resolveTimes, clockIn: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="clockOut" className="text-right">
                Clock Out
              </Label>
              <Input
                id="clockOut"
                type="time"
                className="col-span-3"
                value={resolveTimes.clockOut}
                onChange={(e) => setResolveTimes({...resolveTimes, clockOut: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveModalOpen(false)}>Cancel</Button>
            <Button onClick={handleResolveAbsent} disabled={isResolving}>
              {isResolving ? "Saving..." : "Save Logs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Attendance Modal */}
      <Dialog open={manualModalOpen} onOpenChange={setManualModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-sm">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-xl font-light">Manual Attendance Override</DialogTitle>
            <DialogDescription>
              Super Admin can manually insert clock-in or clock-out events. 
              Use this for correcting missed taps.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label>Select Barista</Label>
              <Select 
                value={manualData.employeeId} 
                onValueChange={(val) => setManualData({...manualData, employeeId: val})}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Choose employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Action Type</Label>
                <Select 
                  value={manualData.type} 
                  onValueChange={(val: any) => setManualData({...manualData, type: val})}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clock-in">
                      <div className="flex items-center gap-2 text-green-600">
                        <UserPlus className="w-4 h-4" /> Clock In
                      </div>
                    </SelectItem>
                    <SelectItem value="clock-out">
                      <div className="flex items-center gap-2 text-destructive">
                        <UserMinus className="w-4 h-4" /> Clock Out
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Date</Label>
                <Input 
                  type="date" 
                  value={manualData.date}
                  onChange={(e) => setManualData({...manualData, date: e.target.value})}
                  className="rounded-sm"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Time (HH:mm)</Label>
              <Input 
                type="time" 
                value={manualData.time}
                onChange={(e) => setManualData({...manualData, time: e.target.value})}
                className="rounded-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-sm" onClick={() => setManualModalOpen(false)}>Cancel</Button>
            <Button 
              className="rounded-sm bg-foreground text-background hover:bg-foreground/90 px-8" 
              onClick={handleManualAction} 
              disabled={isManualLoading}
            >
              {isManualLoading ? "Processing..." : "Commit Action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="rounded-sm border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Barista</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Date</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Shift</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Actual Clock</th>
                <th className="text-center p-4 font-medium text-sm text-muted-foreground">Method</th>
                <th className="text-center p-4 font-medium text-sm text-muted-foreground">Performance</th>
                <th className="text-right p-4 font-medium text-sm text-muted-foreground">Reg. Hours</th>
                <th className="text-right p-4 font-medium text-sm text-muted-foreground">OT Hours</th>
                <th className="text-right p-4 font-medium text-sm text-muted-foreground">Total Hours</th>
                <th className="text-center p-4 font-medium text-sm text-muted-foreground">Penalty</th>
              </tr>
            </thead>
            <tbody>
              {filteredReport.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No attendance records found for the selected period
                  </td>
                </tr>
              ) : (
                filteredReport.map((row, idx) => {
                  const shift = row.shift // Use the matched shift from the backend
                  const totalMinutes = row.regularMinutes + row.overtimeMinutes
                  
                  return (
                    <tr key={`${row.employee_id}-${row.date}-${idx}`} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                            {row.employee_name.charAt(0)}
                          </div>
                          <span className="font-medium text-sm">{row.employee_name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm whitespace-nowrap">
                        {format(parseLocalDate(row.date), "EEE, MMM d")}
                      </td>
                      <td className="p-4">
                        {shift ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-mono">{shift.start_time} - {shift.end_time}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">
                              {shift.shift_name || "Assigned"}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground/50">NO SHIFT</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        {row.isAbsent ? (
                          <div className="flex flex-col items-start gap-1 text-xs">
                            <span className="font-bold text-destructive">Did not clock in</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">Subject to penalty/deduction</span>
                              {isSuperAdmin() && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-5 text-[10px] px-2 py-0 border-primary/20 text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    setResolveData({ employee_id: row.employee_id, employee_name: row.employee_name, date: row.date })
                                    setResolveTimes({ 
                                      clockIn: row.shift?.start_time?.substring(0,5) || "08:00", 
                                      clockOut: row.shift?.end_time?.substring(0,5) || "17:00" 
                                    })
                                    setResolveModalOpen(true)
                                  }}
                                >
                                  Resolve
                                </Button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 text-xs">
                               <span className="font-mono text-green-600 dark:text-green-500">{format(new Date(row.sessions[0].clockIn), "HH:mm")}</span>
                               <span className="text-muted-foreground">—</span>
                               <span className="font-mono text-muted-foreground">
                                 {row.sessions[row.sessions.length - 1].clockOut 
                                   ? format(new Date(row.sessions[row.sessions.length - 1].clockOut), "HH:mm")
                                   : (row.sessions[0]?.otStatus === 'rejected') ? (
                                     <span className="text-destructive font-bold text-[10px] uppercase tracking-wider bg-destructive/10 px-1 py-0.5 rounded-sm">Rejected</span>
                                   ) : (row.sessions[0]?.otStatus === 'pending') ? (
                                     <span className="text-amber-500 font-bold text-[10px] uppercase tracking-wider bg-amber-500/10 px-1 py-0.5 rounded-sm">Pending</span>
                                   ) : (row.sessions[0]?.otStatus === 'approved') ? (
                                     <span className="text-green-500 font-bold text-[10px] uppercase tracking-wider bg-green-500/10 px-1 py-0.5 rounded-sm">Active</span>
                                   ) : (
                                     <div className="flex items-center gap-2">
                                       <span className="text-primary font-bold text-[10px] uppercase tracking-wider bg-primary/10 px-1 py-0.5 rounded-sm">Active</span>
                                       {isSuperAdmin() && (
                                         <button 
                                           onClick={() => triggerForceClockOut(row.employee_id, row.employee_name, row.date)}
                                           className="text-[9px] font-bold text-destructive hover:underline flex items-center gap-1"
                                         >
                                           <UserMinus className="w-3 h-3" /> Force Out
                                         </button>
                                       )}
                                     </div>
                                   )}
                               </span>
                            </div>
                            {row.sessions[row.sessions.length - 1].isAutoClockOut && (
                              <span className="text-[9px] text-orange-500 uppercase font-bold mt-0.5">
                                Auto Tap-out
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="flex flex-col items-center gap-0.5 hover:bg-muted p-1 rounded-md transition-colors">
                                {row.method === 'personal' ? (
                                  <>
                                    <Smartphone className="w-4 h-4 text-primary" />
                                    <span className="text-[9px] font-bold text-primary uppercase">Mobile</span>
                                  </>
                                ) : row.method === 'nfc' ? (
                                  <>
                                    <Fingerprint className="w-4 h-4 text-orange-500" />
                                    <span className="text-[9px] font-bold text-orange-600 uppercase tracking-tighter">OPS NFC</span>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-4 rounded-sm shadow-xl border-primary/20" align="center">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 border-b pb-2">
                                  <Info className="w-4 h-4 text-primary" />
                                  <h4 className="font-bold text-sm tracking-tight">Clock-in Metadata</h4>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-y-2 text-xs">
                                  <span className="text-muted-foreground">Method</span>
                                  <span className="col-span-2 font-medium capitalize">{row.method || 'NFC (System)'}</span>
                                  
                                  <span className="text-muted-foreground">Outlet</span>
                                  <span className="col-span-2 font-medium">{outlets.find(o => o.id === row.outletId)?.name || 'Main Outlet / Onsite'}</span>
                                  
                                  <span className="text-muted-foreground">Device</span>
                                  <span className="col-span-2 font-mono text-[10px] break-all leading-tight">
                                    {row.deviceInfo || (row.method === 'nfc' ? 'Operational Terminal' : 'Unknown')}
                                  </span>
                                  
                                  <span className="text-muted-foreground">IP Addr</span>
                                  <span className="col-span-2 font-mono text-[10px]">{row.sessions?.[0]?.ipAddress || '—'}</span>
                                </div>

                                {row.method === 'personal' && row.sessions?.[0]?.latitude && (
                                  <div className="pt-2 border-t text-[10px] text-muted-foreground italic">
                                    Coord: {row.sessions[0].latitude}, {row.sessions[0].longitude}
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </td>
                       <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          {row.isAbsent ? (
                            <Badge className="bg-destructive/10 text-destructive border-none rounded-sm text-[10px] font-black tracking-widest uppercase">
                              ABSENT
                            </Badge>
                          ) : !shift ? (
                            <Badge variant="outline" className="text-[10px] rounded-sm text-muted-foreground border-dashed uppercase">UNSCHEDULED</Badge>
                          ) : row.isLate ? (
                            <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 rounded-sm text-[10px] font-bold uppercase">
                              LATE {row.lateMinutes}m
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] rounded-sm text-green-500 border-green-500/20 uppercase">Punctual</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono text-sm">
                        {row.isAbsent ? <span className="text-muted-foreground">—</span> : formatHours(row.regularMinutes)}
                      </td>
                      <td className="p-4 text-right font-mono text-sm">
                        <div className="flex flex-col items-end gap-1">
                          <span className={cn(row.overtimeMinutes > 0 ? "text-amber-600 font-bold" : "text-muted-foreground")}>
                            {row.isAbsent ? <span className="text-muted-foreground">—</span> : formatHours(row.overtimeMinutes)}
                          </span>
                          {!row.isAbsent && row.sessions[0]?.otStatus && row.sessions[0].otStatus !== 'none' && (
                            <Badge variant="outline" className={cn(
                              "text-[8.5px] uppercase px-1 py-0 h-4 border-none leading-none tracking-tight",
                              row.sessions[0].otStatus === 'approved' ? "text-green-600 bg-green-500/10" :
                              row.sessions[0].otStatus === 'rejected' ? "text-destructive bg-destructive/10" :
                              "text-amber-600 bg-amber-500/10"
                            )}>
                              OT {row.sessions[0].otStatus}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono text-sm font-bold">
                        {row.isAbsent ? <span className="text-muted-foreground">—</span> : formatHours(totalMinutes)}
                      </td>
                      <td className="p-4 text-center">
                        {row.isAbsent ? (
                           <span className="text-muted-foreground text-[10px]">—</span>
                        ) : row.isPenalty ? (
                          <Badge className="bg-destructive text-destructive-foreground border-none rounded-sm text-[10px] font-black animate-pulse">
                            LATE &gt;15m
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
