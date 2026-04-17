"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  getAttendanceReportData,
  getEmployees,
  getShiftAssignments,
  type Employee,
  type ShiftAssignment
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { 
  Users, 
  CalendarIcon, 
  Clock, 
  Search, 
  AlertTriangle,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Timer as TimerIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, startOfMonth, endOfMonth, isSameDay, subDays, addDays, parseISO } from "date-fns"
import { Input } from "@/components/ui/input"

export default function AttendanceReportPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [reportData, setReportData] = useState<any[]>([])
  const [shifts, setShifts] = useState<ShiftAssignment[]>([])
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const [empData, shiftData, initialReport] = await Promise.all([
        getEmployees(),
        getShiftAssignments(),
        getAttendanceReportData(
          format(dateRange.from, "yyyy-MM-dd"),
          format(dateRange.to, "yyyy-MM-dd")
        )
      ])
      setEmployees(empData)
      setShifts(shiftData)
      setReportData(initialReport)
      setIsLoading(false)
    }
    fetchData()
  }, [])

  const refreshReport = async () => {
    setIsLoading(true)
    const data = await getAttendanceReportData(
      format(dateRange.from, "yyyy-MM-dd"),
      format(dateRange.to, "yyyy-MM-dd")
    )
    setReportData(data)
    setIsLoading(false)
  }

  // Helper to parse YYYY-MM-DD to local Date without UTC shifting
  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const filteredReport = useMemo(() => {
    return reportData.filter(r => 
      r.employee_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [reportData, searchQuery])

  // Rule 6: Stats for the summary cards
  const summaryStats = useMemo(() => {
    const stats = {
      totalHours: 0,
      totalOT: 0,
      lateCount: 0,
      penaltyCount: 0
    }
    
    filteredReport.forEach(r => {
      stats.totalHours += r.regularMinutes / 60
      stats.totalOT += r.overtimeMinutes / 60
      if (r.isLate) stats.lateCount++
      if (r.isPenalty) stats.penaltyCount++
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
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Penalty Category</CardTitle>
            <ShieldAlert className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summaryStats.penaltyCount}</div>
            <p className="text-[10px] text-destructive/70 mt-1 font-bold">Late &gt; 15 minutes</p>
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
                onClick={refreshReport}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Generate Report"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="rounded-sm border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Barista</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Date</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Shift</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Actual Clock</th>
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
                  const shift = getAssignedShift(row.employee_id, row.date)
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
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 text-xs">
                             <span className="font-mono text-green-600 dark:text-green-500">{format(new Date(row.sessions[0].clockIn), "HH:mm")}</span>
                             <span className="text-muted-foreground">—</span>
                             <span className="font-mono text-muted-foreground">
                               {row.sessions[row.sessions.length - 1].clockOut 
                                 ? format(new Date(row.sessions[row.sessions.length - 1].clockOut), "HH:mm")
                                 : "Active"}
                             </span>
                          </div>
                          {row.sessions[row.sessions.length - 1].isAutoClockOut && (
                            <span className="text-[9px] text-orange-500 uppercase font-bold mt-0.5">
                              Auto Tap-out
                            </span>
                          )}
                        </div>
                      </td>
                       <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          {!shift ? (
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
                        {formatHours(row.regularMinutes)}
                      </td>
                      <td className="p-4 text-right font-mono text-sm">
                        <div className="flex flex-col items-end gap-1">
                          <span className={cn(row.overtimeMinutes > 0 ? "text-amber-600 font-bold" : "text-muted-foreground")}>
                            {formatHours(row.overtimeMinutes)}
                          </span>
                          {!shift && row.sessions[0]?.otStatus && (
                            <Badge variant="outline" className={cn(
                              "text-[8.5px] uppercase px-1 py-0 h-4 border-none leading-none tracking-tight",
                              row.sessions[0].otStatus === 'approved' ? "text-green-600 bg-green-500/10" :
                              row.sessions[0].otStatus === 'rejected' ? "text-destructive bg-destructive/10" :
                              "text-muted-foreground bg-muted"
                            )}>
                              OT {row.sessions[0].otStatus}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono text-sm font-bold">
                        {formatHours(totalMinutes)}
                      </td>
                      <td className="p-4 text-center">
                        {row.isPenalty ? (
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
