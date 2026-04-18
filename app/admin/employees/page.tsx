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
  getEmployeeContractHistory,
  renewEmployeeContract,
  uploadEmployeeFile,
  getCurrentUser,
  deleteEmployee,
  getEmployeeKPIs,
  addEmployeeKPI,
  deleteEmployeeKPI,
  type Employee,
  type AttendanceLog,
  type ShiftAssignment,
  type OvertimeRequest,
  type EmployeeContract,
  type EmployeeKPI
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
  Briefcase,
  FileText,
  ExternalLink,
  RefreshCw,
  Calendar,
  AlertCircle,
  Trophy,
  Target,
  BadgeAlert,
  MessageSquare,
  TrendingUp,
  TrendingDown
} from "lucide-react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { format } from "date-fns"

export default function EmployeesPage() {
  const { user, isSuperAdmin, isAdmin } = useAuth()
  const { toast } = useToast()
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
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [contractHistory, setContractHistory] = useState<EmployeeContract[]>([])
  const [isRenewDialogOpen, setIsRenewDialogOpen] = useState(false)
  const [isRenewing, setIsRenewing] = useState(false)
  const [renewalData, setRenewalData] = useState({
    startDate: "",
    endDate: "",
    contractFile: null as File | null
  })

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false)
  const [pendingStatusToggle, setPendingStatusToggle] = useState<{ id: string, current: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // KPI State
  const [kpiLogs, setKpiLogs] = useState<EmployeeKPI[]>([])
  const [isKpiLoading, setIsKpiLoading] = useState(false)
  const [newKpi, setNewKpi] = useState({
    points: 0,
    category: "",
    notes: ""
  })

  const [newEmployee, setNewEmployee] = useState({
    name: "",
    nickname: "",
    email: "",
    password: "",
    position: "employee" as "barista" | "employee",
    employmentType: "full-time" as "full-time" | "part-time",
    nfcUid: "",
    phone: "",
    contractStart: "",
    contractEnd: "",
    avatarFile: null as File | null,
    contractFile: null as File | null
  })

  const [editEmployee, setEditEmployee] = useState({
    id: "",
    name: "",
    nickname: "",
    email: "",
    position: "employee" as "barista" | "employee",
    employmentType: "full-time" as "full-time" | "part-time",
    phone: "",
    contractStart: "",
    contractEnd: "",
    avatarFile: null as File | null,
    contractFile: null as File | null,
    avatarUrl: "",
    contractUrl: ""
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

  const filteredEmployees = employees.filter((emp: Employee) =>
    (emp.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.nickname || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    // If deactivating, ask for confirmation
    if (currentStatus === "active") {
      setPendingStatusToggle({ id, current: currentStatus })
      setIsStatusConfirmOpen(true)
      return
    }

    executeToggleStatus(id, currentStatus)
  }

  const executeToggleStatus = async (id: string, currentStatus: string) => {
    const emp = employees.find((e: Employee) => e.id === id)
    const result = await toggleEmployeeStatus(id, currentStatus)

    if (!result) {
      toast({
        title: "Update Failed",
        description: `Could not change status for ${emp?.name || 'employee'}.`,
        variant: "destructive"
      })
    } else if (emp) {
      const newStatus = currentStatus === "active" ? "inactive" : "active"
      toast({
        title: "Status Updated",
        description: `${emp.name} is now ${newStatus}.`,
      })
      await logActivity(
        "employee_update",
        user?.email || "Admin",
        emp.name || emp.nickname || "Unknown",
        `Changed status from ${currentStatus} to ${newStatus}`
      )
    }
    fetchEmployees()
    setPendingStatusToggle(null)
    setIsStatusConfirmOpen(false)
  }

  const openEditDialog = (employee: Employee) => {
    setEditEmployee({
      id: employee.id,
      name: employee.name,
      nickname: employee.nickname || "",
      email: employee.email,
      position: employee.position || "employee",
      employmentType: employee.employment_type || "full-time",
      phone: employee.phone_number || "",
      contractStart: employee.contract_start_date || "",
      contractEnd: employee.contract_end_date || "",
      avatarFile: null,
      contractFile: null,
      avatarUrl: employee.avatar_url || "",
      contractUrl: employee.contract_pdf_url || ""
    })
    setIsEditDialogOpen(true)
  }

  const handleEditEmployee = async () => {
    if (!editEmployee.name || !editEmployee.nickname || !editEmployee.email) {
      toast({
        title: "Validation Error",
        description: "Name, Nickname, and Email are mandatory fields.",
        variant: "destructive"
      })
      return
    }

    setError("")
    setUploadingFiles(true)

    let avatarUrl = undefined
    let contractUrl = undefined

    if (editEmployee.avatarFile) {
      const ext = editEmployee.avatarFile.name.split('.').pop()
      const path = `${editEmployee.id}.${ext}`
      const uploaded = await uploadEmployeeFile(editEmployee.avatarFile, 'avatars', path)
      if (uploaded) avatarUrl = path
    }

    if (editEmployee.contractFile) {
      const ext = editEmployee.contractFile.name.split('.').pop()
      const path = `${editEmployee.id}-${Date.now()}.${ext}`
      const uploaded = await uploadEmployeeFile(editEmployee.contractFile, 'contracts', path)
      if (uploaded) contractUrl = path
    }

    // Note: Role is NOT updated here - role changes are handled in Settings by super_admin only
    const updates: Partial<Employee> = {
      name: editEmployee.name,
      nickname: editEmployee.nickname,
      email: editEmployee.email,
      position: editEmployee.position,
      employment_type: editEmployee.employmentType,
      phone_number: editEmployee.phone || null,
      contract_start_date: editEmployee.contractStart || null,
      contract_end_date: editEmployee.contractEnd || null
    }

    if (avatarUrl) updates.avatar_url = avatarUrl
    if (contractUrl) updates.contract_pdf_url = contractUrl

    const result = await updateEmployee(editEmployee.id, updates)
    setUploadingFiles(false)
    if (!result) {
      toast({
        title: "Update Error",
        description: "Failed to update employee details. Please try again.",
        variant: "destructive"
      })
      return
    }

    toast({
      title: "Settings Saved",
      description: `Employee profile for ${editEmployee.name} has been updated.`,
    })

    await logActivity(
      "employee_update",
      user?.email || "Admin",
      editEmployee.name,
      `Updated employee profile`
    )

    setIsEditDialogOpen(false)
    await fetchEmployees()
  }

  const handleAssignNFC = async () => {
    if (!selectedEmployee || !nfcInput) return

    const success = await assignNFC(selectedEmployee.id, nfcInput.toUpperCase())

    if (success) {
      toast({
        title: "NFC Assigned",
        description: `NFC UID ${nfcInput.toUpperCase()} has been linked to ${selectedEmployee.name}.`,
      })
    } else {
      toast({
        title: "Assignment Error",
        description: "Could not assign NFC card. It might be already in use.",
        variant: "destructive"
      })
    }

    setNfcInput("")
    setIsNFCDialogOpen(false)
    setSelectedEmployee(null)
    fetchEmployees()
  }

  const handleAddEmployee = async () => {
    if (!newEmployee.name || !newEmployee.nickname || !newEmployee.email || !newEmployee.password) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields marked with *.",
        variant: "destructive"
      })
      return
    }

    setUploadingFiles(true)

    const result = await addEmployee({
      name: newEmployee.name,
      nickname: newEmployee.nickname,
      email: newEmployee.email,
      password: newEmployee.password,
      role: "employee",
      position: newEmployee.position,
      employment_type: newEmployee.employmentType,
      nfc_uid: newEmployee.nfcUid || null,
      status: 'active',
      phone_number: newEmployee.phone || null,
      contract_start_date: newEmployee.contractStart || null,
      contract_end_date: newEmployee.contractEnd || null,
      // Temporarily null, we will update after insert to get the ID for the file path
      avatar_url: null,
      contract_pdf_url: null
    })

    if (result) {
      let needsUpdate = false
      const updates: Partial<Employee> = {}

      if (newEmployee.avatarFile) {
        const ext = newEmployee.avatarFile.name.split('.').pop()
        const path = `${result.id}.${ext}`
        const uploaded = await uploadEmployeeFile(newEmployee.avatarFile, 'avatars', path)
        if (uploaded) {
          updates.avatar_url = path
          needsUpdate = true
        }
      }

      if (newEmployee.contractFile) {
        const ext = newEmployee.contractFile.name.split('.').pop()
        const path = `${result.id}-contract.${ext}`
        const uploaded = await uploadEmployeeFile(newEmployee.contractFile, 'contracts', path)
        if (uploaded) {
          updates.contract_pdf_url = path
          needsUpdate = true
        }
      }

      if (needsUpdate) {
        await updateEmployee(result.id, updates)
      }

      await logActivity(
        "employee_update",
        user?.email || "Admin",
        newEmployee.name,
        `Added new employee: ${newEmployee.nickname} (${newEmployee.email})`
      )

      toast({
        title: "Employee Added",
        description: `${newEmployee.nickname} has been successfully registered.`,
      })
    }

    setUploadingFiles(false)
    await fetchEmployees()

    setNewEmployee({
      name: "",
      nickname: "",
      email: "",
      password: "",
      position: "employee",
      employmentType: "full-time",
      nfcUid: "",
      phone: "",
      contractStart: "",
      contractEnd: "",
      avatarFile: null,
      contractFile: null
    })

    setIsAddDialogOpen(false)
  }

  const handleRowClick = async (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsViewDialogOpen(true)

    // Fetch contract history
    const history = await getEmployeeContractHistory(employee.id)
    setContractHistory(history)
  }

  const getContractTimeRemaining = (endDate: string | null | undefined) => {
    if (!endDate) return null
    const end = new Date(endDate)
    const now = new Date()
    const diffTime = end.getTime() - now.getTime()

    if (diffTime < 0) return { text: "Expired", color: "text-red-500", bg: "bg-red-500/10" }

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays <= 30) return { text: `${diffDays} days left`, color: "text-amber-600", bg: "bg-amber-500/10" }

    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths === 0) return { text: `${diffDays} days left`, color: "text-amber-600", bg: "bg-amber-500/10" }

    return { text: `${diffMonths} months left`, color: "text-blue-600", bg: "bg-blue-500/10" }
  }

  const handleRenewContract = async () => {
    if (!selectedEmployee || !renewalData.startDate || !renewalData.endDate) return
    setIsRenewing(true)

    try {
      let pdfUrl = selectedEmployee.contract_pdf_url || null

      // Upload new PDF if provided
      if (renewalData.contractFile) {
        const path = `contract_${selectedEmployee.id}_${Date.now()}.pdf`
        const uploadedPath = await uploadEmployeeFile(renewalData.contractFile, 'contracts', path)
        if (uploadedPath) pdfUrl = uploadedPath
      }

      const success = await renewEmployeeContract(selectedEmployee.id, {
        start_date: renewalData.startDate,
        end_date: renewalData.endDate,
        pdf_url: pdfUrl
      }, getCurrentUser()?.name || 'Admin')

      if (success) {
        toast({
          title: "Contract Renewed",
          description: `Contract for ${selectedEmployee.name} has been successfully extended.`,
        })
        setIsRenewDialogOpen(false)
        setIsViewDialogOpen(false)
        fetchEmployees()
        // Reset renewal data
        setRenewalData({ startDate: "", endDate: "", contractFile: null })
      } else {
        toast({
          title: "Renewal Failed",
          description: "Could not update contract. Please try again.",
          variant: "destructive"
        })
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred during contract renewal.",
        variant: "destructive"
      })
      console.error("Renewal error:", err)
    } finally {
      setIsRenewing(false)
    }
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

  const handleViewContract = (employee: Employee) => {
    if (!employee.contract_pdf_url) return
    const url = `/resources/contracts/${employee.contract_pdf_url}`
    window.open(url, '_blank')
  }

  const fetchHistoryData = async () => {
    if (!selectedEmployee) return
    const history = await getEmployeeContractHistory(selectedEmployee.id)
    setContractHistory(history)
  }

  useEffect(() => {
    if (isViewDialogOpen && selectedEmployee) {
      fetchHistoryData()
      fetchKPIs(selectedEmployee.id)
    }
  }, [isViewDialogOpen, selectedEmployee])

  const fetchKPIs = async (empId: string) => {
    setIsKpiLoading(true)
    const data = await getEmployeeKPIs(empId)
    setKpiLogs(data)
    setIsKpiLoading(false)
  }

  const handleAddKPI = async () => {
    if (!selectedEmployee || !newKpi.category) return

    const user = await getCurrentUser()
    const result = await addEmployeeKPI({
      employee_id: selectedEmployee.id,
      points: newKpi.points,
      category: newKpi.category,
      notes: newKpi.notes,
      date: new Date().toISOString().split('T')[0],
      created_by: user?.email || 'Admin'
    })

    if (result) {
      toast({
        title: "KPI Updated",
        description: `Successfully added ${newKpi.points} points for ${newKpi.category}`,
      })
      setNewKpi({ points: 0, category: "", notes: "" })
      fetchKPIs(selectedEmployee.id)
    }
  }

  const handleDeleteKPI = async (id: string) => {
    const success = await deleteEmployeeKPI(id)
    if (success && selectedEmployee) {
      fetchKPIs(selectedEmployee.id)
    }
  }

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return
    setIsDeleting(true)

    try {
      const success = await deleteEmployee(selectedEmployee.id)

      if (success) {
        toast({
          title: "Employee Deleted",
          description: `${selectedEmployee.name} has been permanently removed from active directories. Audit logs are preserved.`,
        })

        await logActivity(
          "employee_delete",
          "Admin",
          selectedEmployee.name,
          `Permanently deleted employee (Soft Delete)`
        )

        setIsDeleteDialogOpen(false)
        setSelectedEmployee(null)
        await fetchEmployees()
      } else {
        toast({
          title: "Deletion Failed",
          description: "Could not delete employee. Please try again.",
          variant: "destructive"
        })
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      })
    } finally {
      setIsDeleting(false)
    }
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
          <Card
            key={employee.id}
            className={cn(
              "rounded-sm transition-opacity hover:shadow-sm",
              employee.status === "inactive" && "opacity-60"
            )}
          >
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-4">
                {employee.avatar_url ? (
                  <img src={employee.avatar_url.startsWith('/') ? employee.avatar_url : `/resources/avatars/${employee.avatar_url}`} alt={employee.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center">
                    <span className="text-lg font-medium">
                      {employee.nickname?.charAt(0)}
                    </span>
                  </div>
                )}
                <div>
                  <CardTitle className="text-lg">{employee.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{employee.nickname}</p>
                </div>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-sm">
                    {/* View Profile - Available to all admins */}
                    <DropdownMenuItem onClick={() => handleRowClick(employee)}>
                      <Briefcase className="w-4 h-4 mr-2" />
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
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
                    {/* View Contract - if exists */}
                    {employee.contract_pdf_url && (
                      <DropdownMenuItem onClick={() => handleViewContract(employee)}>
                        <FileText className="w-4 h-4 mr-2" />
                        View Contract
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
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => {
                            setSelectedEmployee(employee)
                            setIsDeleteDialogOpen(true)
                          }}
                        >
                          <UserX className="w-4 h-4 mr-2" />
                          Delete Employee
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
                {employee.contract_end_date && employee.status === 'active' && (() => {
                  const remaining = getContractTimeRemaining(employee.contract_end_date)
                  if (!remaining) return null
                  return (
                    <Badge variant="outline" className={cn("ml-2 text-[10px] border-none px-2 rounded-full", remaining.bg, remaining.color)}>
                      {remaining.text}
                    </Badge>
                  )
                })()}
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

            <div className="grid grid-cols-2 gap-4">
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
                <Label>Phone Number</Label>
                <Input
                  placeholder="e.g., 08123456789"
                  value={newEmployee.phone}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, phone: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
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
                <Label>Contract Start Date</Label>
                <Input
                  type="date"
                  value={newEmployee.contractStart}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, contractStart: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Contract End Date</Label>
                <Input
                  type="date"
                  value={newEmployee.contractEnd}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, contractEnd: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Photo / Avatar</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, avatarFile: e.target.files?.[0] || null }))}
                  className="rounded-sm text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>Contract PDF</Label>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, contractFile: e.target.files?.[0] || null }))}
                  className="rounded-sm text-xs"
                />
              </div>
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
              disabled={!newEmployee.name || !newEmployee.nickname || !newEmployee.email || !newEmployee.password || uploadingFiles}
              className="rounded-sm"
            >
              {uploadingFiles ? 'Saving...' : 'Add Employee'}
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

            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  placeholder="e.g., 08123456789"
                  value={editEmployee.phone}
                  onChange={(e) => setEditEmployee(prev => ({ ...prev, phone: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contract Start Date</Label>
                <Input
                  type="date"
                  value={editEmployee.contractStart}
                  onChange={(e) => setEditEmployee(prev => ({ ...prev, contractStart: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Contract End Date</Label>
                <Input
                  type="date"
                  value={editEmployee.contractEnd}
                  onChange={(e) => setEditEmployee(prev => ({ ...prev, contractEnd: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Photo / Avatar</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditEmployee(prev => ({ ...prev, avatarFile: e.target.files?.[0] || null }))}
                  className="rounded-sm text-xs"
                />
                <p className="text-xs text-muted-foreground">Upload to replace existing photo</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Contract PDF</Label>
                  {editEmployee.contractUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(`/resources/contracts/${editEmployee.contractUrl}`, '_blank')}
                      className="text-[10px] text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View current contract
                    </button>
                  )}
                </div>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setEditEmployee(prev => ({ ...prev, contractFile: e.target.files?.[0] || null }))}
                  className="rounded-sm text-xs"
                />
                <p className="text-xs text-muted-foreground">Upload to replace existing contract</p>
              </div>
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
              disabled={!editEmployee.name || !editEmployee.nickname || !editEmployee.email || uploadingFiles}
              className="rounded-sm"
            >
              {uploadingFiles ? 'Saving...' : 'Save Changes'}
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

      {/* View Employee Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="rounded-sm sm:max-w-[450px] max-h-[90vh] overflow-y-auto pr-4">
          <DialogHeader>
            <DialogTitle>Employee Profile</DialogTitle>
            <DialogDescription>
              Detailed information for {selectedEmployee?.name}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2 rounded-sm h-12 bg-muted/30 p-1">
              <TabsTrigger value="basic" className="rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Users className="w-4 h-4 mr-2" />
                Basic Info
              </TabsTrigger>
              <TabsTrigger value="performance" className="rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Trophy className="w-4 h-4 mr-2" />
                Performance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="py-4 space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center gap-4 border-b border-border/50 pb-4">
                {selectedEmployee?.avatar_url ? (
                  <img src={selectedEmployee.avatar_url.startsWith('/') ? selectedEmployee.avatar_url : `/resources/avatars/${selectedEmployee.avatar_url}`} alt={selectedEmployee.name} className="w-16 h-16 rounded-full object-cover shadow-sm border border-border/50" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center border border-border/50">
                    <span className="text-2xl font-medium">
                      {selectedEmployee?.nickname?.charAt(0)}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-medium">{selectedEmployee?.name}</h3>
                  <p className="text-muted-foreground">{selectedEmployee?.nickname}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="capitalize text-[10px] bg-muted/30">{selectedEmployee?.position}</Badge>
                    <Badge variant="outline" className="capitalize text-[10px] bg-muted/30">{selectedEmployee?.employment_type}</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Email Address</p>
                    <p className="font-medium">{selectedEmployee?.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Phone Number</p>
                    <p className="font-medium">{selectedEmployee?.phone_number || "Not provided"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Status</p>
                    <Badge variant="outline" className={cn(
                      "capitalize text-[11px] rounded-none py-0 h-5",
                      selectedEmployee?.status === 'active' ? "border-[var(--status-healthy)] text-[var(--status-healthy)]" : "border-muted text-muted-foreground"
                    )}>
                      {selectedEmployee?.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">System Role</p>
                    <Badge variant="secondary" className="capitalize text-[11px] rounded-none py-0 h-5 bg-muted">
                      {selectedEmployee?.role.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/50 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Contract Information</h4>
                  {isSuperAdmin() && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] text-primary"
                      onClick={() => {
                        setRenewalData(prev => ({
                          ...prev,
                          startDate: selectedEmployee?.contract_end_date || ""
                        }))
                        setIsRenewDialogOpen(true)
                      }}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Renew Contract
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-sm border border-border/50">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Current Duration</p>
                    <p className="text-sm font-medium">
                      {selectedEmployee?.contract_start_date ? format(new Date(selectedEmployee.contract_start_date), "MMM d, yyyy") : "?"} -
                      {selectedEmployee?.contract_end_date ? format(new Date(selectedEmployee.contract_end_date), "MMM d, yyyy") : "?"}
                    </p>
                  </div>
                  {selectedEmployee?.contract_end_date && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Status</p>
                      {(() => {
                        const remaining = getContractTimeRemaining(selectedEmployee.contract_end_date)
                        return remaining ? (
                          <Badge variant="outline" className={cn("text-[10px] border-none px-2 rounded-none h-4", remaining.bg, remaining.color)}>
                            {remaining.text}
                          </Badge>
                        ) : null
                      })()}
                    </div>
                  )}
                </div>

                {selectedEmployee?.contract_pdf_url && (
                  <Button variant="outline" size="sm" className="w-full h-9 text-xs flex gap-2 rounded-sm border-dashed" onClick={() => {
                    const url = `/resources/contracts/${selectedEmployee.contract_pdf_url}`;
                    window.open(url, "_blank");
                  }}>
                    <FileText className="w-4 h-4" />
                    View Current Document
                  </Button>
                )}
                {contractHistory.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contract History</p>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                      {contractHistory.map((history) => (
                        <div key={history.id} className="flex items-center justify-between p-2 bg-muted/20 border border-border/50 rounded-sm">
                          <div>
                            <p className="text-xs font-medium">
                              {format(new Date(history.start_date), "MMM yyyy")} - {format(new Date(history.end_date), "MMM yyyy")}
                            </p>
                            <p className="text-[9px] text-muted-foreground">Original contract document</p>
                          </div>
                          {history.contract_pdf_url && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(`/resources/contracts/${history.contract_pdf_url}`, "_blank")}>
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="performance" className="py-4 space-y-6 animate-in slide-in-from-right-2 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary/5 p-4 rounded-sm border border-primary/10">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Current Merit</p>
                  <p className="text-3xl font-bold text-primary">
                    {kpiLogs.reduce((sum, log) => sum + log.points, 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">performance points</p>
                </div>
                <div className="bg-muted/30 p-4 rounded-sm border border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Logs Entry</p>
                  <p className="text-3xl font-bold">{kpiLogs.length}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Evaluations recorded</p>
                </div>
              </div>

              {/* Add KPI Log Interface (Admin Only) */}
              {(isSuperAdmin() || isAdmin()) && (
                <div className="bg-muted/10 p-4 rounded-sm border border-border/50 space-y-4">
                  <h4 className="text-xs font-bold flex items-center gap-2">
                    <BadgeAlert className="w-3.5 h-3.5" />
                    RECORD PERFORMANCE EVENT
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase opacity-70">Category</Label>
                      <Select value={newKpi.category} onValueChange={(v) => setNewKpi(p => ({ ...p, category: v }))}>
                        <SelectTrigger className="h-8 text-xs rounded-sm">
                          <SelectValue placeholder="Select or type..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-sm">
                          <SelectItem value="Sales Performance">Sales Performance</SelectItem>
                          <SelectItem value="Upselling">Upselling (Add-ons)</SelectItem>
                          <SelectItem value="Service Speed">Service Speed</SelectItem>
                          <SelectItem value="Attendance">Attendance & Punctuality</SelectItem>
                          <SelectItem value="Cleanliness">Cleanliness</SelectItem>
                          <SelectItem value="Customer Service">Customer Service</SelectItem>
                          <SelectItem value="Other">Other (Custom)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase opacity-70">Points</Label>
                      <Input
                        type="number"
                        value={newKpi.points}
                        onChange={(e) => setNewKpi(p => ({ ...p, points: parseInt(e.target.value) || 0 }))}
                        className="h-8 text-xs rounded-sm"
                        placeholder="+/- Points"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase opacity-70">Internal Notes</Label>
                    <Textarea
                      value={newKpi.notes}
                      onChange={(e) => setNewKpi(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Admin evaluation and feedback notes..."
                      className="text-xs min-h-[60px] rounded-sm"
                    />
                  </div>
                  <Button size="sm" className="w-full h-8 text-xs rounded-sm" onClick={handleAddKPI} disabled={!newKpi.category}>
                    <Plus className="w-3.5 h-3.5 mr-2" />
                    Record Evaluation
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                  <History className="w-3.5 h-3.5" />
                  EVALUATION HISTORY (INTERNAL)
                </h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {kpiLogs.length === 0 ? (
                    <div className="text-center py-8 border border-dashed rounded-sm">
                      <p className="text-xs text-muted-foreground">No performance logs found</p>
                    </div>
                  ) : (
                    kpiLogs.map((log) => (
                      <div key={log.id} className="group relative bg-background border border-border/50 p-3 rounded-sm hover:shadow-sm transition-all duration-200">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-xs font-bold px-1.5 py-0.5 rounded-sm",
                              log.points > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                            )}>
                              {log.points > 0 ? '+' : ''}{log.points}
                            </span>
                            <span className="text-[11px] font-semibold">{log.category}</span>
                          </div>
                          <span className="text-[9px] text-muted-foreground/60 font-mono">
                            {format(new Date(log.date), "MMM d, yyyy")}
                          </span>
                        </div>
                        {log.notes && (
                          <p className="text-[10px] text-muted-foreground leading-relaxed italic border-l-2 border-primary/20 pl-2 mt-2">
                            "{log.notes}"
                          </p>
                        )}
                        <p className="text-[9px] text-muted-foreground/40 mt-1 text-right italic">by {log.created_by}</p>

                        {isAdmin() && (
                          <button
                            onClick={() => handleDeleteKPI(log.id)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-background border border-border/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive shadow-sm"
                          >
                            <UserX className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>



      {/* Renew Contract Dialog */}
      <Dialog open={isRenewDialogOpen} onOpenChange={setIsRenewDialogOpen}>
        <DialogContent className="rounded-sm sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Renew Contract
            </DialogTitle>
            <DialogDescription>
              Extend contract for {selectedEmployee?.name}. Current contract will be archived to history.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Start Date</Label>
              <Input
                type="date"
                value={renewalData.startDate}
                onChange={(e) => setRenewalData(prev => ({ ...prev, startDate: e.target.value }))}
                className="rounded-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>New End Date</Label>
              <Input
                type="date"
                value={renewalData.endDate}
                onChange={(e) => setRenewalData(prev => ({ ...prev, endDate: e.target.value }))}
                className="rounded-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>New Contract PDF (Optional)</Label>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setRenewalData(prev => ({ ...prev, contractFile: e.target.files?.[0] || null }))}
                className="rounded-sm text-xs cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Leave empty to keep current document link
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenewDialogOpen(false)} disabled={isRenewing}>
              Cancel
            </Button>
            <Button onClick={handleRenewContract} disabled={isRenewing || !renewalData.startDate || !renewalData.endDate}>
              {isRenewing ? "Renewing..." : "Confirm Renewal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Status Deactivation */}
      <AlertDialog open={isStatusConfirmOpen} onOpenChange={setIsStatusConfirmOpen}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Karyawan?</AlertDialogTitle>
            <AlertDialogDescription>
              Karyawan yang dinonaktifkan tidak akan bisa login atau melakukan absensi. Anda bisa mengaktifkan mereka kembali kapan saja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => pendingStatusToggle && executeToggleStatus(pendingStatusToggle.id, pendingStatusToggle.current)}
            >
              Ya, Nonaktifkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog for Deletion (if needed) */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Remove Employee Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This employee will be removed from the active roster and will no longer have access to the system. Historical data (attendance & logs) will be preserved for audit purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteEmployee}
              disabled={isDeleting}
              className="rounded-sm"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Yes, delete"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
