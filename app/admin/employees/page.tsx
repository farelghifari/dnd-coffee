"use client"

import { useState, useEffect } from "react"
import { 
  getEmployees, 
  addEmployee, 
  updateEmployee,
  assignNFC,
  toggleEmployeeStatus,
  getAttendanceByEmployee,
  getShiftsByEmployee,
  getOvertimeRequests,
  calculateRegulatedSession,
  logActivity,
  type Employee,
  type AttendanceLog,
  type ShiftAssignment,
  type OvertimeRequest
} from "@/lib/api/supabase-service"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Users, 
  Search, 
  Plus,
  CreditCard,
  Mail,
  MoreVertical,
  UserCheck,
  UserX,
  History,
  Key,
  Briefcase
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { format } from "date-fns"

export default function EmployeesPage() {
  const { isSuperAdmin } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isNFCDialogOpen, setIsNFCDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [nfcInput, setNfcInput] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [empShifts, setEmpShifts] = useState<ShiftAssignment[]>([])
  const [empOvertimeRequests, setEmpOvertimeRequests] = useState<OvertimeRequest[]>([])
  
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    nickname: "",
    email: "",
    password: "",
    position: "employee" as "barista" | "employee",
    employmentType: "full-time" as "full-time" | "part-time",
    nfcUid: ""
  })
  
  const [editEmployee, setEditEmployee] = useState({
    id: "",
    name: "",
    nickname: "",
    email: "",
    position: "employee" as "barista" | "employee",
    employmentType: "full-time" as "full-time" | "part-time"
  })

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    setIsLoading(true)
    const data = await getEmployees()
    setEmployees(data)
    setIsLoading(false)
  }

  const filteredEmployees = employees.filter((emp) =>
    (emp.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.nickname || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    setError("")
    const emp = employees.find(e => e.id === id)
    const result = await toggleEmployeeStatus(id, currentStatus)
    if (!result) {
      setError("Failed to update employee status")
    } else if (emp) {
      const newStatus = currentStatus === "active" ? "inactive" : "active"
      await logActivity(
        "employee_update",
        "Admin",
        emp.name || emp.nickname || "Unknown",
        `Changed status from ${currentStatus} to ${newStatus}`
      )
    }
    fetchEmployees()
  }
  
  const openEditDialog = (employee: Employee) => {
    setEditEmployee({
      id: employee.id,
      name: employee.name,
      nickname: employee.nickname || "",
      email: employee.email,
      position: employee.position || "employee",
      employmentType: employee.employment_type || "full-time"
    })
    setIsEditDialogOpen(true)
  }
  
  const handleEditEmployee = async () => {
    if (!editEmployee.name || !editEmployee.nickname || !editEmployee.email) return
    
    setError("")
    
    // MANDATORY DEBUG - Required for position update troubleshooting
    const selected_user_id = editEmployee.id
    const new_position = editEmployee.position
    console.log("UPDATE POSITION ID:", selected_user_id)
    console.log("NEW POSITION:", new_position)
    console.log("EMPLOYMENT TYPE:", editEmployee.employmentType)
    
    // Note: Role is NOT updated here - role changes are handled in Settings by super_admin only
    const result = await updateEmployee(selected_user_id, {
      name: editEmployee.name,
      nickname: editEmployee.nickname,
      email: editEmployee.email,
      position: new_position,
      employment_type: editEmployee.employmentType
    })
    
    console.log("ERROR:", result === null ? "Update returned null" : null)
    console.log("RESULT:", result)
    
    if (!result) {
      setError("Failed to update employee")
      return
    }
    
    // VERIFY SAVE - Check position was saved correctly
    if (result.position !== new_position) {
      console.log("ERROR: Position not saved! Expected:", new_position, "Got:", result.position)
      setError(`Position update failed. Expected: ${new_position}, Got: ${result.position}`)
      return
    }
    
    console.log("SUCCESS: Position updated to", result.position)
    
    // Log the update
    await logActivity(
      "employee_update",
      "Admin",
      editEmployee.name,
      `Updated employee: position=${new_position}, employment_type=${editEmployee.employmentType}`
    )
    
    setIsEditDialogOpen(false)
    // REFETCH DATA - Immediately refetch employees
    await fetchEmployees()
  }

  const handleAssignNFC = async () => {
    if (!selectedEmployee || !nfcInput) return

    await assignNFC(selectedEmployee.id, nfcInput.toUpperCase())

    setNfcInput("")
    setIsNFCDialogOpen(false)
    setSelectedEmployee(null)
    fetchEmployees()
  }

  const handleAddEmployee = async () => {
    if (!newEmployee.name || !newEmployee.nickname || !newEmployee.email || !newEmployee.password) return

    // Always create employees with role = 'employee'
    // Role promotion is handled in Settings by super_admin only
    const result = await addEmployee({
      name: newEmployee.name,
      nickname: newEmployee.nickname,
      email: newEmployee.email,
      password: newEmployee.password,
      role: "employee",
      position: newEmployee.position,
      employment_type: newEmployee.employmentType,
      nfc_uid: newEmployee.nfcUid || null,
      status: 'active'
    })

    // Log the new employee addition
    if (result) {
      await logActivity(
        "employee_update",
        "Admin",
        newEmployee.name,
        `Added new employee: ${newEmployee.nickname} (${newEmployee.email})`
      )
    }

    await fetchEmployees()

    setNewEmployee({
      name: "",
      nickname: "",
      email: "",
      password: "",
      position: "employee",
      employmentType: "full-time",
      nfcUid: ""
    })

    setIsAddDialogOpen(false)
  }

  const handleViewAttendance = async (employee: Employee) => {
    setSelectedEmployee(employee)
    const [logs, shifts, otRequests] = await Promise.all([
      getAttendanceByEmployee(employee.id),
      getShiftsByEmployee(employee.id),
      getOvertimeRequests()
    ])
    setAttendanceLogs(logs)
    setEmpShifts(shifts)
    setEmpOvertimeRequests(otRequests)
    setIsHistoryDialogOpen(true)
  }

  const getPositionBadge = (position: string) => {
    return position === "barista" 
      ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
      : "bg-slate-500/10 text-slate-600 border-slate-500/20"
  }

  const getEmploymentBadge = (type: string) => {
    return type === "full-time" 
      ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
      : "bg-teal-500/10 text-teal-600 border-teal-500/20"
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
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Employees</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin() ? "Manage staff and access permissions" : "View staff directory"}
          </p>
        </div>
        {isSuperAdmin() && (
          <Button className="rounded-sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        )}
      </header>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 rounded-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[calc(100vh-280px)] overflow-y-auto">
        {filteredEmployees.map((employee) => (
          <Card key={employee.id} className={cn(
            "rounded-sm transition-opacity",
            employee.status === "inactive" && "opacity-60"
          )}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-sm bg-foreground/5 flex items-center justify-center">
                  <span className="text-lg font-medium">
                    {employee.nickname?.charAt(0)}
                  </span>
                </div>
                <div>
                  <CardTitle className="text-lg">{employee.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{employee.nickname}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-sm">
                  {/* Edit Details - Super Admin only */}
                  {isSuperAdmin() && (
                    <DropdownMenuItem onClick={() => openEditDialog(employee)}>Edit Details</DropdownMenuItem>
                  )}
                  {/* NFC Assignment - Super Admin only */}
                  {isSuperAdmin() && (
                    <DropdownMenuItem onClick={() => {
                      setSelectedEmployee(employee)
                      setIsNFCDialogOpen(true)
                    }}>
                      <CreditCard className="w-4 h-4 mr-2" />
                      {employee.nfc_uid ? "Change NFC Card" : "Assign NFC Card"}
                    </DropdownMenuItem>
                  )}
                  {/* View Attendance - Available to all admins */}
                  <DropdownMenuItem onClick={() => handleViewAttendance(employee)}>
                    <History className="w-4 h-4 mr-2" />
                    View Attendance
                  </DropdownMenuItem>
                  {/* Toggle Status - Super Admin only */}
                  {isSuperAdmin() && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleToggleStatus(employee.id, employee.status)}>
                        {employee.status === "active" ? (
                          <>
                            <UserX className="w-4 h-4 mr-2" />
                            Disable Access
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 mr-2" />
                            Enable Access
                          </>
                        )}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{employee.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <span className={cn(
                  "font-mono",
                  employee.nfc_uid ? "text-muted-foreground" : "text-[var(--status-warning)]"
                )}>
                  {employee.nfc_uid || "No card assigned"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <Badge variant="outline" className={cn(
                  "rounded-sm capitalize",
                  getPositionBadge(employee.position || "employee")
                )}>
                  {employee.position || "employee"}
                </Badge>
                <Badge variant="outline" className={cn(
                  "rounded-sm capitalize",
                  getEmploymentBadge(employee.employment_type || "full-time")
                )}>
                  {employee.employment_type || "full-time"}
                </Badge>
              </div>
              <div className="flex items-center justify-between pt-2">
                <Badge 
                  variant="outline"
                  className={cn(
                    "rounded-sm capitalize",
                    employee.status === "active" 
                      ? "bg-[var(--status-healthy)]/10 text-[var(--status-healthy)] border-[var(--status-healthy)]/20"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  {employee.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No employees found</p>
        </div>
      )}

      {/* Add Employee Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="rounded-sm sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Enter the details for the new employee. They will be able to login using the email and password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  placeholder="e.g., John Doe"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Nickname *</Label>
                <Input
                  placeholder="e.g., John"
                  value={newEmployee.nickname}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, nickname: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email *
              </Label>
              <Input
                type="email"
                placeholder="e.g., john@example.com"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))}
                className="rounded-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                Password *
              </Label>
              <Input
                type="password"
                placeholder="Set login password"
                value={newEmployee.password}
                onChange={(e) => setNewEmployee(prev => ({ ...prev, password: e.target.value }))}
                className="rounded-sm"
              />
              <p className="text-xs text-muted-foreground">
                Employee will use this password to login
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Position *</Label>
                <Select 
                  value={newEmployee.position} 
                  onValueChange={(value: "barista" | "employee") => 
                    setNewEmployee(prev => ({ ...prev, position: value }))
                  }
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm">
                    <SelectItem value="barista">Barista</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Employment Type *</Label>
                <Select 
                  value={newEmployee.employmentType} 
                  onValueChange={(value: "full-time" | "part-time") => 
                    setNewEmployee(prev => ({ ...prev, employmentType: value }))
                  }
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm">
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              All new employees start with the "employee" role. Role promotion to admin is handled in Settings. Shifts are assigned via Scheduling.
            </p>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                NFC Card UID (Optional)
              </Label>
              <Input
                placeholder="e.g., A1B2C3D4"
                value={newEmployee.nfcUid}
                onChange={(e) => setNewEmployee(prev => ({ ...prev, nfcUid: e.target.value }))}
                className="rounded-sm font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Can be assigned later from the employee card
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button 
              onClick={handleAddEmployee} 
              disabled={!newEmployee.name || !newEmployee.nickname || !newEmployee.email || !newEmployee.password} 
              className="rounded-sm"
            >
              Add Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NFC Assignment Dialog */}
      <Dialog open={isNFCDialogOpen} onOpenChange={setIsNFCDialogOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle>Assign NFC Card</DialogTitle>
            <DialogDescription>
              Enter the NFC card UID for {selectedEmployee?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>NFC UID</Label>
              <Input
                placeholder="e.g., A1B2C3D4"
                value={nfcInput}
                onChange={(e) => setNfcInput(e.target.value)}
                className="rounded-sm font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Scan the NFC card or enter the UID manually
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNFCDialogOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button onClick={handleAssignNFC} disabled={!nfcInput} className="rounded-sm">
              Assign Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="rounded-sm sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update the employee details.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-sm">
              {error}
            </div>
          )}
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  placeholder="e.g., John Doe"
                  value={editEmployee.name}
                  onChange={(e) => setEditEmployee(prev => ({ ...prev, name: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Nickname *</Label>
                <Input
                  placeholder="e.g., John"
                  value={editEmployee.nickname}
                  onChange={(e) => setEditEmployee(prev => ({ ...prev, nickname: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email *
              </Label>
              <Input
                type="email"
                placeholder="e.g., john@example.com"
                value={editEmployee.email}
                onChange={(e) => setEditEmployee(prev => ({ ...prev, email: e.target.value }))}
                className="rounded-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Position *</Label>
                <Select 
                  value={editEmployee.position} 
                  onValueChange={(value: "barista" | "employee") => 
                    setEditEmployee(prev => ({ ...prev, position: value }))
                  }
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm">
                    <SelectItem value="barista">Barista</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Employment Type *</Label>
                <Select 
                  value={editEmployee.employmentType} 
                  onValueChange={(value: "full-time" | "part-time") => 
                    setEditEmployee(prev => ({ ...prev, employmentType: value }))
                  }
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm">
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Role management is handled in Settings by super admins. Shifts are assigned via Scheduling.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button 
              onClick={handleEditEmployee} 
              disabled={!editEmployee.name || !editEmployee.nickname || !editEmployee.email} 
              className="rounded-sm"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="rounded-sm max-w-lg">
          <DialogHeader>
            <DialogTitle>Attendance History</DialogTitle>
            <DialogDescription>
              Recent attendance records for {selectedEmployee?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[400px] overflow-y-auto">
            <div className="space-y-2">
              {attendanceLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No attendance records</p>
              ) : (
                (() => {
                  type ProcessedLog = AttendanceLog & {
                    _isVirtual?: boolean
                    _sessionMinutes?: number
                    _isAutoClockOut?: boolean
                    _isEarlyTapIn?: boolean
                    _shiftStart?: string
                    _shiftEnd?: string
                  }

                  const otMap = new Map<string, OvertimeRequest>()
                  for (const ot of empOvertimeRequests) {
                    if (ot.attendance_log_id) otMap.set(ot.attendance_log_id, ot)
                  }

                  const logsByDate = new Map<string, AttendanceLog[]>()
                  for (const log of attendanceLogs) {
                    const date = log.date || log.timestamp?.split('T')[0] || ''
                    if (!logsByDate.has(date)) logsByDate.set(date, [])
                    logsByDate.get(date)!.push(log)
                  }

                  const allProcessed: ProcessedLog[] = []

                  for (const [dateStr, dayLogs] of logsByDate) {
                    const sorted = [...dayLogs]
                      .filter(l => l.status !== 'rejected')
                      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                    
                    const shift = empShifts.find(s => s.date === dateStr)
                    let currentIn: AttendanceLog | null = null

                    for (const log of sorted) {
                      const action = log.action || log.type
                      if (action === 'clock-in') {
                        if (currentIn) {
                          const otReq = otMap.get(currentIn.id)
                          const session = calculateRegulatedSession(currentIn, null, shift, otReq?.status || 'none')
                          allProcessed.push({ ...currentIn })
                          if (session.isAutoClockOut && session.clockOut) {
                            allProcessed.push({
                              id: `virtual-${currentIn.id}`,
                              employee_id: currentIn.employee_id,
                              employee_name: currentIn.employee_name,
                              date: currentIn.date,
                              time: new Date(session.clockOut).toTimeString().substring(0, 8),
                              timestamp: session.clockOut,
                              action: 'clock-out', status: 'auto', type: 'clock-out',
                              _isVirtual: true, _isAutoClockOut: true,
                              _sessionMinutes: session.regularMinutes,
                              _shiftStart: shift?.start_time?.substring(0, 5),
                              _shiftEnd: shift?.end_time?.substring(0, 5),
                            })
                          }
                        }
                        currentIn = log
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
                          action: 'clock-out', status: 'auto', type: 'clock-out',
                          _isVirtual: true, _isAutoClockOut: true,
                          _sessionMinutes: session.regularMinutes,
                          _shiftStart: shift?.start_time?.substring(0, 5),
                          _shiftEnd: shift?.end_time?.substring(0, 5),
                        })
                      }
                    }
                  }

                  const display = allProcessed
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 30)

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
                          "flex items-center justify-between p-3 rounded-sm",
                          log._isVirtual 
                            ? "bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50" 
                            : "bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            isClockIn ? "bg-[var(--status-healthy)]" 
                            : log._isVirtual ? "bg-amber-500"
                            : "bg-muted-foreground"
                          )} />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium capitalize">
                                {log._isVirtual ? "Clock Out (Auto)" : (log.type || log.action || "clock-in")?.replace("-", " ")}
                              </span>
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
                            {isClockOut && log._shiftStart && log._shiftEnd && (
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">Shift {log._shiftStart}-{log._shiftEnd}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-mono">
                            {format(new Date(log.timestamp || `${log.date || ""}T${log.time || "00:00"}`), "HH:mm")}
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(log.timestamp || `${log.date || ""}T${log.time || "00:00"}`), "MMM d")}
                          </p>
                        </div>
                      </div>
                    )
                  })
                })()
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
