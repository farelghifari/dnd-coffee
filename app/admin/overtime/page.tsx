"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { 
  getOvertimeRequests,
  getActiveEmployees,
  getPendingOvertimeRequests,
  approveOvertimeRequest,
  rejectOvertimeRequest,
  getShiftsByEmployee,
  logActivity,
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { 
  Clock, 
  Check, 
  X, 
  AlertTriangle,
  Calendar,
  User,
  FileText,
  Timer
} from "lucide-react"
import { cn } from "@/lib/utils"

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
  const [rejectNotes, setRejectNotes] = useState("")
  const [activeTab, setActiveTab] = useState("pending")

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
  const approvedRequests = overtimeRequests.filter(r => r.status === "approved")
  const rejectedRequests = overtimeRequests.filter(r => r.status === "rejected")

  const handleApprove = async (requestId: string) => {
    const request = overtimeRequests.find(r => r.id === requestId)
    await approveOvertimeRequest(requestId, user?.email || "Admin")
    
    // Log the approval
    if (request) {
      await logActivity(
        "overtime_action",
        user?.email || "Admin",
        request.employee_name || "Unknown",
        `Approved overtime request for ${formatDate(request.request_date, "short")}`
      )
    }
    
    fetchData()
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

  const openRejectDialog = (requestId: string) => {
    setSelectedRequest(requestId)
    setIsRejectDialogOpen(true)
  }

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
                      Overtime: {formatOvertimeDisplay(overtimeMinutes)}
                    </Badge>
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
                    onClick={() => handleApprove(request.id)}
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
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="relative">
            Pending
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 text-background text-xs rounded-full flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

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
    </div>
  )
}
