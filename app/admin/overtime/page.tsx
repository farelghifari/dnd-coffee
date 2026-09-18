"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/lib/auth-context"
import { 
  getOvertimeRequests,
  getActiveEmployees,
  getPendingOvertimeRequests,
  approveOvertimeRequest,
  rejectOvertimeRequest,
  getShiftsByEmployee,
  addOvertimeRequest,
  logActivity,
  deleteOvertimeRequest,
  updateOvertimeRequest,
  type OvertimeRequest,
  type Employee,
  type ShiftAssignment
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Clock, 
  Check, 
  X, 
  AlertTriangle,
  Calendar,
  User,
  FileText,
  Timer,
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays
} from "lucide-react"
import { cn, getLocalYYYYMMDD } from "@/lib/utils"
import { toast } from "sonner"
import { 
  format, 
  startOfWeek, 
  addDays, 
  subWeeks, 
  addWeeks, 
  isToday, 
  parseISO 
} from "date-fns"

// Helper function to format dates safely
function formatDate(dateStr: string, formatStr: "full" | "short" = "full"): string {
  try {
    const date = new Date(dateStr)
    if (formatStr === "full") {
      return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  } catch {
    return dateStr
  }
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  } catch {
    return dateStr
  }
}

// Calculate overtime minutes from scheduled end and actual clock out
function calculateOvertimeMinutes(scheduledEnd: string, actualClockOut: string): number {
  try {
    const [schedH, schedM] = scheduledEnd.split(":").map(Number)
    const actualDate = new Date(actualClockOut)
    const actualH = actualDate.getHours()
    const actualM = actualDate.getMinutes()
    
    const scheduledMinutes = schedH * 60 + schedM
    const actualMinutes = actualH * 60 + actualM
    
    // If actual clock out is after scheduled end, calculate overtime
    if (actualMinutes > scheduledMinutes) {
      return actualMinutes - scheduledMinutes
    }
    return 0
  } catch {
    return 0
  }
}

// Format overtime minutes as "X hours Y minutes"
function formatOvertimeDisplay(minutes: number): string {
  if (minutes <= 0) return "No overtime"
  
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (hours > 0 && mins > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`
  } else {
    return `${mins} minute${mins !== 1 ? 's' : ''}`
  }
}

export default function OvertimePage() {
  const { user } = useAuth()
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [approveDuration, setApproveDuration] = useState("1")
  const [rejectNotes, setRejectNotes] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar")
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    return startOfWeek(today, { weekStartsOn: 1 }) // Monday
  })

  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [scheduleData, setScheduleData] = useState<{
    employeeId: string;
    date: string;
    startTime: string;
    durationHours: string;
    editId?: string;
  }>({
    employeeId: "",
    date: "",
    startTime: "09:00",
    durationHours: "1"
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    const [requestsData, employeesData] = await Promise.all([
      getOvertimeRequests(),
      getActiveEmployees()
    ])
    setOvertimeRequests(requestsData)
    setEmployees(employeesData)
    setIsLoading(false)
  }

  const pendingRequests = overtimeRequests.filter(r => r.status === "pending")
  const approvedRequests = overtimeRequests.filter(r => r.status === "approved" && !r.is_scheduled)
  const scheduledRequests = overtimeRequests.filter(r => r.is_scheduled)
  const rejectedRequests = overtimeRequests.filter(r => r.status === "rejected")

  const handleApprove = async () => {
    if (!selectedRequest) return
    
    const request = overtimeRequests.find(r => r.id === selectedRequest)
    const durationMins = parseFloat(approveDuration) * 60
    
    await approveOvertimeRequest(selectedRequest, user?.email || "Admin", durationMins)
    
    // Log the approval
    if (request) {
      await logActivity(
        "overtime_action",
        user?.email || "Admin",
        request.employee_name || "Unknown",
        `Approved overtime request for ${formatDate(request.request_date, "short")} with ${approveDuration} hours limit`
      )
    }
    
    setIsApproveDialogOpen(false)
    setSelectedRequest(null)
    setApproveDuration("1")
    fetchData()
  }

  const openApproveDialog = (requestId: string) => {
    setSelectedRequest(requestId)
    setIsApproveDialogOpen(true)
  }

  const handleReject = async () => {
    if (selectedRequest) {
      const request = overtimeRequests.find(r => r.id === selectedRequest)
      await rejectOvertimeRequest(selectedRequest, user?.email || "Admin", rejectNotes)
      
      // Log the rejection
      if (request) {
        await logActivity(
          "overtime_action",
          user?.email || "Admin",
          request.employee_name || "Unknown",
          `Rejected overtime request for ${formatDate(request.request_date, "short")}${rejectNotes ? `: ${rejectNotes}` : ''}`
        )
      }
      
      setIsRejectDialogOpen(false)
      setSelectedRequest(null)
      setRejectNotes("")
      fetchData()
    }
  }

  const handleScheduleOvertime = async () => {
    if (!scheduleData.employeeId || !scheduleData.date) return
    
    setIsSubmitting(true)
    const emp = employees.find(e => e.id === scheduleData.employeeId)
    if (!emp) {
      setIsSubmitting(false)
      return
    }

    const durationMins = parseFloat(scheduleData.durationHours) * 60
    // Timezone Fix: Don't use .000Z which forces UTC. 
    const clockInIso = `${scheduleData.date}T${scheduleData.startTime}:00`

    let result = null
    const reqPayload = {
      employee_id: scheduleData.employeeId,
      employee_name: emp.nickname || emp.name,
      attendance_log_id: null,
      request_date: scheduleData.date,
      clock_in_time: clockInIso,
      status: "approved" as const,
      is_scheduled: true,
      approved_overtime_minutes: durationMins,
      notes: "Pre-planned overtime by Admin"
    }

    if (scheduleData.editId) {
      result = await updateOvertimeRequest(scheduleData.editId, reqPayload)
    } else {
      result = await addOvertimeRequest(reqPayload)
    }

    if (result) {
      await logActivity(
        "overtime_action",
        user?.email || "Admin",
        emp.nickname || emp.name,
        `${scheduleData.editId ? "Updated scheduled" : "Scheduled"} overtime on ${scheduleData.date} (${scheduleData.startTime}, ${scheduleData.durationHours}h)`
      )
      toast.success(`Overtime ${scheduleData.editId ? "updated" : "scheduled"} for ${emp.nickname || emp.name}`)
      setIsScheduleDialogOpen(false)
      setScheduleData({ employeeId: "", date: "", startTime: "09:00", durationHours: "1" })
      fetchData()
    } else {
      toast.error("Failed to save schedule.")
    }
    setIsSubmitting(false)
  }

  const openRejectDialog = (requestId: string) => {
    setSelectedRequest(requestId)
    setIsRejectDialogOpen(true)
  }

  const handleRemoveOvertime = async (id: string, empName: string, date: string) => {
    if (!confirm("Are you sure you want to cancel this overtime schedule?")) return
    
    const res = await deleteOvertimeRequest(id)
    if (res) {
      toast.success("Overtime schedule cancelled")
      await logActivity(
        "overtime_action",
        user?.email || "Admin",
        empName,
        `Cancelled overtime schedule for ${date}`
      )
      fetchData()
    } else {
      toast.error("Failed to cancel overtime")
    }
  }

  // Generate 7 days starting from currentWeekStart
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(currentWeekStart, i)
      return {
        date: d,
        dateStr: format(d, 'yyyy-MM-dd'),
        dayName: format(d, 'EEE'),
        dayNum: format(d, 'd')
      }
    })
  }, [currentWeekStart])

  const getEmployeeInfo = (employeeId: string) => {
    return employees.find(e => e.id === employeeId)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending</Badge>
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Approved</Badge>
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">Rejected</Badge>
      default:
        return null
    }
  }

  const renderRequestCard = (request: OvertimeRequest, showActions: boolean = false) => {
    const employee = getEmployeeInfo(request.employee_id)
    
    // Calculate overtime if we have the data
    const overtimeMinutes = request.overtime_minutes || 
      (request.scheduled_end_time && request.actual_clock_out_time 
        ? calculateOvertimeMinutes(request.scheduled_end_time, request.actual_clock_out_time)
        : 0)
    
    return (
      <Card key={request.id} className="rounded-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-sm bg-foreground/5 flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">{request.employee_name || "Unknown Employee"}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  {formatDate(request.request_date, "full")}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  Clocked in at {formatTime(request.clock_in_time)}
                </div>
                
                {/* Overtime Duration Display */}
                {overtimeMinutes > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <Timer className="w-4 h-4 text-orange-500" />
                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800">
                      Actual: {formatOvertimeDisplay(overtimeMinutes)}
                    </Badge>
                  </div>
                )}
                
                {request.status === "approved" && request.approved_overtime_minutes && (
                  <div className="flex items-center gap-2 mt-1">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-xs font-medium text-green-600">
                      Approved Limit: {formatOvertimeDisplay(request.approved_overtime_minutes)}
                    </span>
                  </div>
                )}
                
                {/* Scheduled vs Actual Times */}
                {request.scheduled_end_time && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Scheduled end: {request.scheduled_end_time}
                    {request.actual_clock_out_time && (
                      <span className="ml-2">| Actual: {formatTime(request.actual_clock_out_time)}</span>
                    )}
                  </div>
                )}
                
                {employee && (
                  <Badge variant="outline" className="rounded-sm text-xs mt-2">
                    {employee.employment_type || "full-time"}
                  </Badge>
                )}
                {request.is_scheduled && (
                  <Badge variant="outline" className="rounded-sm text-xs mt-2 bg-blue-500/10 text-blue-600 border-blue-500/20 ml-2">
                    Scheduled
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(request.status)}
              
              {showActions && (
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-sm text-green-600 hover:bg-green-50 hover:text-green-700"
                    onClick={() => openApproveDialog(request.id)}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => openRejectDialog(request.id)}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              )}

              {request.status === "approved" && request.is_scheduled && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-sm text-red-600 hover:bg-red-50 hover:text-red-700 mt-2"
                  onClick={() => handleRemoveOvertime(request.id, request.employee_name, request.request_date)}
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel Schedule
                </Button>
              )}
              
              {request.status !== "pending" && request.reviewed_at && (
                <p className="text-xs text-muted-foreground">
                  {request.status === "approved" ? "Approved" : "Rejected"} by {request.reviewed_by}
                  <br />
                  {formatDate(request.reviewed_at, "short")}
                </p>
              )}
              
              {request.notes && (
                <div className="flex items-start gap-1 text-xs text-muted-foreground max-w-[200px]">
                  <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                  <span className="italic">{request.notes}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    )
  }

  const renderCalendarView = () => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))} className="rounded-sm h-8 w-8 p-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[150px] text-center">
              {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
            </span>
            <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))} className="rounded-sm h-8 w-8 p-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="text-xs h-8">
            Today
          </Button>
        </div>

        <div className="rounded-sm border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[150px_repeat(7,1fr)] bg-muted/50 border-b">
            <div className="p-3 text-xs font-medium text-muted-foreground border-r">Employee</div>
            {weekDates.map(day => (
              <div key={day.dateStr} className={cn("p-3 text-center border-r last:border-r-0", isToday(day.date) && "bg-foreground/5")}>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">{day.dayName}</p>
                <p className="text-sm font-bold">{day.dayNum}</p>
              </div>
            ))}
          </div>

          {/* Rows */}
          <ScrollArea className="h-[calc(100vh-420px)]">
            <div className="flex flex-col">
              {employees.map(emp => (
                <div key={emp.id} className="grid grid-cols-[150px_repeat(7,1fr)] border-b last:border-b-0 hover:bg-muted/5 transition-colors">
                  <div className="p-3 border-r flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-sm bg-foreground/5 flex items-center justify-center shrink-0 text-[10px] font-bold">
                      {emp.nickname ? emp.nickname.charAt(0) : emp.name.charAt(0)}
                    </div>
                    <span className="text-xs font-medium truncate">{emp.nickname || emp.name}</span>
                  </div>
                  {weekDates.map(day => {
                    const scheduledOTArr = scheduledRequests.filter(r => r.employee_id === emp.id && r.request_date === day.dateStr)
                    return (
                      <div key={day.dateStr} className="p-1 border-r last:border-r-0 min-h-[60px] flex flex-col gap-1">
                        {scheduledOTArr.map(ot => (
                          <div 
                            key={ot.id} 
                            onClick={(e) => {
                              // Don't trigger if they clicked the remove button
                              if ((e.target as HTMLElement).closest('button')) return;
                              setScheduleData({
                                employeeId: emp.id,
                                date: day.dateStr,
                                startTime: formatTime(ot.clock_in_time),
                                durationHours: (ot.approved_overtime_minutes! / 60).toString(),
                                editId: ot.id
                              })
                              setIsScheduleDialogOpen(true)
                            }}
                            className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-sm p-1 text-[10px] relative group cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            <p className="font-bold leading-tight pointer-events-none">{formatTime(ot.clock_in_time)}</p>
                            <p className="opacity-80 pointer-events-none">Limit: {ot.approved_overtime_minutes}m</p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveOvertime(ot.id, ot.employee_name, ot.request_date);
                              }}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-sm"
                            >
                              <X className="w-2 h-2" />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => {
                            setScheduleData({ 
                              employeeId: emp.id, 
                              date: day.dateStr, 
                              startTime: "09:00", 
                              durationHours: "1" 
                            })
                            setIsScheduleDialogOpen(true)
                          }}
                          className="flex-1 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-sm hover:bg-muted/10"
                        >
                          <Plus className="w-3 h-3 text-muted-foreground/30" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-light tracking-tight">Overtime Requests</h1>
        <p className="text-muted-foreground">Review and manage overtime attendance requests</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <Check className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedRequests.length}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <X className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedRequests.length}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="pending" className="relative">
              Pending
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 text-background text-[10px] rounded-full flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted p-1 rounded-sm mr-2 border">
              <Button 
                variant={viewMode === "list" ? "secondary" : "ghost"} 
                size="sm" 
                className="h-7 text-xs rounded-sm px-2"
                onClick={() => setViewMode("list")}
              >
                <FileText className="w-3 h-3 mr-1" />
                List
              </Button>
              <Button 
                variant={viewMode === "calendar" ? "secondary" : "ghost"} 
                size="sm" 
                className="h-7 text-xs rounded-sm px-2"
                onClick={() => setViewMode("calendar")}
              >
                <CalendarDays className="w-3 h-3 mr-1" />
                Calendar
              </Button>
            </div>
            <Button 
              className="rounded-sm bg-blue-600 hover:bg-blue-700"
              onClick={() => setIsScheduleDialogOpen(true)}
            >
              <Clock className="w-4 h-4 mr-2" />
              Schedule Overtime
            </Button>
          </div>
        </div>

        <TabsContent value="pending">
          <ScrollArea className="h-[calc(100vh-450px)]">
            {pendingRequests.length === 0 ? (
              <Card className="rounded-sm">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Check className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No pending requests</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request) => renderRequestCard(request, true))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="approved">
          <ScrollArea className="h-[calc(100vh-450px)]">
            {approvedRequests.length === 0 ? (
              <Card className="rounded-sm">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Check className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No approved requests</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {approvedRequests.map((request) => renderRequestCard(request))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="scheduled">
          {viewMode === "calendar" ? renderCalendarView() : (
            <ScrollArea className="h-[calc(100vh-450px)]">
              {scheduledRequests.length === 0 ? (
                <Card className="rounded-sm">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No pre-planned overtime</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {scheduledRequests.map((request) => renderRequestCard(request))}
                </div>
              )}
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="rejected">
          <ScrollArea className="h-[calc(100vh-450px)]">
            {rejectedRequests.length === 0 ? (
              <Card className="rounded-sm">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <X className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No rejected requests</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {rejectedRequests.map((request) => renderRequestCard(request))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-sm">
          <DialogHeader>
            <DialogTitle>Approve Overtime Request</DialogTitle>
            <DialogDescription>
              Set the total allowed hours for this overtime session. 
              The system will automatically clock out the employee once they reach this limit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Overtime Duration (Hours)</Label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                placeholder="e.g., 1, 2, 0.5"
                value={approveDuration}
                onChange={(e) => setApproveDuration(e.target.value)}
                className="rounded-sm"
              />
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                Equivalent to {parseFloat(approveDuration || "0") * 60} minutes
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button onClick={handleApprove} className="rounded-sm bg-green-600 hover:bg-green-700">
              Approve Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-sm">
          <DialogHeader>
            <DialogTitle>Reject Overtime Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this overtime request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rejection Notes (Optional)</Label>
              <Textarea
                placeholder="e.g., No shift coverage needed, already at overtime limit..."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                className="rounded-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} className="rounded-sm">
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Schedule OT Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={(open) => {
        setIsScheduleDialogOpen(open)
        if (!open) {
          // Reset when closed
          setTimeout(() => setScheduleData({ employeeId: "", date: "", startTime: "09:00", durationHours: "1" }), 200)
        }
      }}>
        <DialogContent className="sm:max-w-[400px] rounded-sm">
          <DialogHeader>
            <DialogTitle>{scheduleData.editId ? "Edit Schedule" : "Schedule Overtime"}</DialogTitle>
            <DialogDescription>
              {scheduleData.editId 
                ? "Update the pre-planned overtime session." 
                : "Pre-plan an overtime session for a barista. No approval will be needed when they clock in."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Barista</Label>
              <Select 
                value={scheduleData.employeeId} 
                onValueChange={(val) => setScheduleData(prev => ({ ...prev, employeeId: val }))}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Pick a barista" />
                </SelectTrigger>
                <SelectContent className="rounded-sm">
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.nickname || emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={scheduleData.date}
                onChange={(e) => setScheduleData(prev => ({ ...prev, date: e.target.value }))}
                className="rounded-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={scheduleData.startTime}
                  onChange={(e) => setScheduleData(prev => ({ ...prev, startTime: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (Hours)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={scheduleData.durationHours}
                  onChange={(e) => setScheduleData(prev => ({ ...prev, durationHours: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button 
              onClick={handleScheduleOvertime} 
              disabled={!scheduleData.employeeId || !scheduleData.date || isSubmitting}
              className="rounded-sm bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? "Saving..." : (scheduleData.editId ? "Update Schedule" : "Add Schedule")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
