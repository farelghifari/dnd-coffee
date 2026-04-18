"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  getAttendanceReportData,
  getEmployees,
  getPayrolls,
  upsertPayroll,
  settlePayrollBatch,
  settlePayrollItems,
  cancelPayrollItems,
  type Employee,
  type PayrollRecord
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  Wallet, 
  Calendar as CalendarIcon, 
  Save, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Clock,
  Briefcase,
  Search,
  RefreshCw,
  Users,
  RotateCcw
} from "lucide-react"
import { cn, getLocalYYYYMMDD } from "@/lib/utils"
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns"
import { 
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

export default function PayrollAdminPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendanceReport, setAttendanceReport] = useState<any[]>([])
  const [storedPayrolls, setStoredPayrolls] = useState<PayrollRecord[]>([])
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Modal state for cancel/settle confirmation
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    type: 'cancel' | 'settle' | 'settle_all'
    employeeId: string
    employeeName: string
    row?: any
  }>({ open: false, type: 'cancel', employeeId: '', employeeName: '' })

  // Local state for adjustments and hourly rates (since they might not be in DB yet)
  const [adjustments, setAdjustments] = useState<Record<string, number>>({})
  const [hourlyRates, setHourlyRates] = useState<Record<string, number>>({})

  const fetchAllData = async () => {
    setIsLoading(true)
    const startStr = format(dateRange.from, "yyyy-MM-dd")
    const endStr = format(dateRange.to, "yyyy-MM-dd")
    
    try {
      const [empData, reportData, payrollData] = await Promise.all([
        getEmployees(),
        getAttendanceReportData(startStr, endStr),
        getPayrolls(startStr, endStr)
      ])
      
      setEmployees(empData)
      setAttendanceReport(reportData)
      setStoredPayrolls(payrollData)
      
      // Initialize local state from stored payrolls
      const localAdjustments: Record<string, number> = {}
      const localRates: Record<string, number> = {}
      
      // Sort payrollData: Put current exact matches last so they "win" in the forEach loop below
      const sortedPayrolls = [...payrollData].sort((a, b) => {
        const startStr = format(dateRange.from, "yyyy-MM-dd")
        const endStr = format(dateRange.to, "yyyy-MM-dd")
        const aExact = a.start_date === startStr && a.end_date === endStr
        const bExact = b.start_date === startStr && b.end_date === endStr
        if (aExact && !bExact) return 1
        if (!aExact && bExact) return -1
        // If both are exact or both are overlapping, use the most recently updated
        return new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime()
      })
      
      sortedPayrolls.forEach(p => {
        localAdjustments[p.employee_id] = p.adjustment
        localRates[p.employee_id] = p.salary_hourly
      })
      
      setAdjustments(localAdjustments)
      setHourlyRates(localRates)
    } catch (error) {
      console.error("Failed to fetch payroll data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [dateRange.from, dateRange.to])

  // Aggregate attendance data per employee
  const aggregatedData = useMemo(() => {
    const agg: Record<string, { 
      employee_id: string; 
      name: string; 
      employment_type: string;
      regMins: number; 
      otMins: number; 
      lateCount: number;
      lateMins: number;
      absentCount: number;
      status: "draft" | "settled" 
    }> = {}
    
    // Initialize with all active employees
    employees.forEach(emp => {
      agg[emp.id] = {
        employee_id: emp.id,
        name: emp.name,
        employment_type: emp.employment_type || "part-time",
        regMins: 0,
        otMins: 0,
        lateCount: 0,
        lateMins: 0,
        absentCount: 0,
        status: "draft"
      }
    })
    
    // Sum minutes and stats from report
    attendanceReport.forEach(row => {
      if (agg[row.employee_id]) {
        if (row.isAbsent) {
          agg[row.employee_id].absentCount += 1;
        } else {
          agg[row.employee_id].regMins += row.regularMinutes;
          agg[row.employee_id].otMins += row.overtimeMinutes;
          if (row.isLate) {
            agg[row.employee_id].lateCount += 1;
            agg[row.employee_id].lateMins += Math.max(0, row.lateMinutes || 0);
          }
        }
      }
    })
    
    // Update status from stored payrolls (Exact matches take priority for status)
    const startStr = format(dateRange.from, "yyyy-MM-dd")
    const endStr = format(dateRange.to, "yyyy-MM-dd")
    
    // Sort to ensure exact match status wins
    const sortedStored = [...storedPayrolls].sort((a, b) => {
      const aExact = a.start_date === startStr && a.end_date === endStr
      const bExact = b.start_date === startStr && b.end_date === endStr
      if (aExact && !bExact) return 1
      if (!aExact && bExact) return -1
      return 0
    })

    sortedStored.forEach(p => {
      if (agg[p.employee_id]) {
        agg[p.employee_id].status = p.status
      }
    })
    
    return Object.values(agg).filter(a => 
      a.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [employees, attendanceReport, storedPayrolls, searchQuery])

  const handleSave = async (empId: string, currentData: any) => {
    setIsSaving(true)
    const rate = hourlyRates[empId] || 0
    const adj = adjustments[empId] || 0
    const totalHours = (currentData.regMins + currentData.otMins) / 60
    const totalPayroll = (totalHours * rate) + adj
    
    const record: PayrollRecord = {
      employee_id: empId,
      start_date: format(dateRange.from, "yyyy-MM-dd"),
      end_date: format(dateRange.to, "yyyy-MM-dd"),
      total_hours: totalHours,
      ot_hours: currentData.otMins / 60,
      salary_hourly: rate,
      adjustment: adj,
      total_payroll: totalPayroll,
      status: "draft"
    }
    
    const success = await upsertPayroll(record)
    if (success) {
      // Refresh to get updated storedPayrolls
      const startStr = format(dateRange.from, "yyyy-MM-dd")
      const endStr = format(dateRange.to, "yyyy-MM-dd")
      const payrollData = await getPayrolls(startStr, endStr)
      setStoredPayrolls(payrollData)
    }
    setIsSaving(false)
  }

  const handleSettleAll = async () => {
    setConfirmModal({
      open: true,
      type: 'settle_all',
      employeeId: 'all',
      employeeName: 'All Staff'
    })
  }

  const trulySettleAll = async () => {
    // First save all current states as draft to ensure logic is updated
    for (const data of aggregatedData) {
      if (data.status === 'draft') {
        const rate = hourlyRates[data.employee_id] || 0
        const adj = adjustments[data.employee_id] || 0
        const totalHours = (data.regMins + data.otMins) / 60
        const totalPayroll = (totalHours * rate) + adj
        
        await upsertPayroll({
          employee_id: data.employee_id,
          start_date: format(dateRange.from, "yyyy-MM-dd"),
          end_date: format(dateRange.to, "yyyy-MM-dd"),
          total_hours: totalHours,
          ot_hours: data.otMins / 60,
          salary_hourly: rate,
          adjustment: adj,
          total_payroll: totalPayroll,
          status: "draft"
        })
      }
    }
    
    const success = await settlePayrollBatch(
      format(dateRange.from, "yyyy-MM-dd"),
      format(dateRange.to, "yyyy-MM-dd")
    )
    
    if (success) {
      await fetchAllData()
    }
    setIsSaving(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Employee Payroll</h1>
          <p className="text-muted-foreground">Calculate and settle salaries based on attendance reports.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="grid gap-1.5">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Period Selection</label>
            <div className="flex items-center gap-2">
              <div className="flex bg-muted p-1 rounded-md border border-border">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    "text-[10px] h-7 px-2 font-bold",
                    format(dateRange.from, "yyyy-MM-dd") === format(startOfMonth(new Date()), "yyyy-MM-dd") && "bg-background shadow-sm"
                  )}
                  onClick={() => setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}
                >
                  THIS MONTH
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-[10px] h-7 px-2 font-bold"
                  onClick={() => {
                    const d = new Date()
                    d.setMonth(d.getMonth() - 1)
                    setDateRange({ from: startOfMonth(d), to: endOfMonth(d) })
                  }}
                >
                  LAST MONTH
                </Button>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[280px] justify-start text-left font-normal bg-card h-10 border-primary/20 hover:border-primary">
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    <span className="font-semibold text-xs">
                      {format(dateRange.from, "dd MMM yyyy")} - {format(dateRange.to, "dd MMM yyyy")}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range: any) => {
                      if (range?.from) {
                        setDateRange({ from: range.from, to: range.to || range.from })
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10 border-primary/20"
                onClick={fetchAllData}
                disabled={isLoading}
                title="Refresh Data"
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </div>
          </div>

          <Button 
            className="bg-green-600 hover:bg-green-700 text-white h-10 mt-auto" 
            onClick={handleSettleAll}
            disabled={isLoading || isSaving || aggregatedData.length === 0}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Settle All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Total Staff</p>
              <p className="text-2xl font-bold">{employees.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Total Period Hours</p>
              <p className="text-2xl font-bold">
                {aggregatedData.reduce((sum, a) => sum + (a.regMins + a.otMins)/60, 0).toFixed(1)}h
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Total Payroll Est.</p>
              <p className="text-2xl font-bold">
                {formatCurrency(aggregatedData.reduce((sum, a) => {
                  const rate = hourlyRates[a.employee_id] || 0
                  const adj = adjustments[a.employee_id] || 0
                  return sum + (((a.regMins + a.otMins)/60) * rate) + adj
                }, 0))}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50/50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Settled Ratio</p>
              <p className="text-2xl font-bold">
                {aggregatedData.filter(a => a.status === 'settled').length}/{aggregatedData.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle>Payroll Worksheet</CardTitle>
            <CardDescription>Input rates and adjustments before settling.</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employee..."
              className="pl-9 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/50 border-y border-border">
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider">Employee</th>
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider text-center">Attendance</th>
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider text-right">Total Hours</th>
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider text-right">Hourly Rate</th>
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider text-right">Adjustment</th>
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider text-right">Final Pay</th>
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider text-center">Status</th>
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground italic">Fetching data...</p>
                    </td>
                  </tr>
                ) : aggregatedData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-muted-foreground">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  aggregatedData.map((row) => {
                    const isSettled = row.status === "settled"
                    const totalHrs = (row.regMins + row.otMins) / 60
                    const currentRate = hourlyRates[row.employee_id] || 0
                    const currentAdj = adjustments[row.employee_id] || 0
                    const totalPay = (totalHrs * currentRate) + currentAdj

                    return (
                      <tr key={row.employee_id} className={cn(
                        "hover:bg-muted/30 transition-colors",
                        isSettled && "bg-green-50/20 dark:bg-green-950/5"
                      )}>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">{row.name}</span>
                            <span className="text-[10px] uppercase text-muted-foreground font-bold">{row.employment_type}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1 items-center justify-center text-xs">
                            {row.absentCount > 0 ? (
                              <span className="text-destructive font-bold">{row.absentCount} Absent</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                            {row.lateCount > 0 && (
                              <span className="text-orange-500 font-medium">{row.lateCount} Late ({row.lateMins}m)</span>
                            )}
                            {row.absentCount === 0 && row.lateCount === 0 && (
                              <span className="text-green-600 font-medium text-[10px] uppercase">Perfect</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right font-mono text-sm">
                          {totalHrs.toFixed(1)}h
                          <div className="text-[10px] text-amber-600 font-bold">
                            OT: {(row.otMins / 60).toFixed(1)}h
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <Input
                            type="number"
                            disabled={isSettled}
                            className="w-24 ml-auto h-8 text-right font-mono text-xs border-muted-foreground/30 focus:border-primary"
                            value={currentRate}
                            onChange={(e) => setHourlyRates({ ...hourlyRates, [row.employee_id]: Number(e.target.value) })}
                          />
                        </td>
                        <td className="p-4 text-right">
                          <Input
                            type="number"
                            disabled={isSettled}
                            className="w-24 ml-auto h-8 text-right font-mono text-xs border-muted-foreground/30 focus:border-primary"
                            value={currentAdj}
                            onChange={(e) => setAdjustments({ ...adjustments, [row.employee_id]: Number(e.target.value) })}
                          />
                        </td>
                        <td className="p-4 text-right font-bold text-sm whitespace-nowrap text-green-600">
                          {formatCurrency(totalPay)}
                        </td>
                        <td className="p-4 text-center">
                          <Badge variant={isSettled ? "default" : "outline"} className={cn(
                            "text-[10px] rounded-sm uppercase font-black",
                            isSettled ? "bg-green-600 hover:bg-green-600" : 
                            "text-amber-600 border-amber-600/30"
                          )}>
                            {row.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                              disabled={isSettled || isSaving}
                              title="Save Draft"
                              onClick={() => handleSave(row.employee_id, row)}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            
                            {isSettled && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                disabled={isSaving}
                                title="Cancel Settlement"
                                onClick={() => setConfirmModal({
                                  open: true,
                                  type: 'cancel',
                                  employeeId: row.employee_id,
                                  employeeName: row.name
                                })}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}

                            {!isSettled && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-green-600 hover:bg-green-50"
                                disabled={isSaving}
                                title="Settle Employee"
                                onClick={() => setConfirmModal({
                                  open: true,
                                  type: 'settle',
                                  employeeId: row.employee_id,
                                  employeeName: row.name,
                                  row
                                })}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {!isLoading && aggregatedData.length > 0 && (
         <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs">
           <AlertCircle className="h-4 w-4 shrink-0" />
           <p>
             <strong>Important:</strong> Ensure all shift assignments and attendance logs are correct in the Attendance Report before settling. 
             Adjustments can be used for bonuses or deductions.
           </p>
         </div>
      )}

      {/* Confirmation Modal */}
      <AlertDialog open={confirmModal.open} onOpenChange={(open) => setConfirmModal(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmModal.type === 'cancel' ? 'Cancel Settlement' : 
               confirmModal.type === 'settle' ? 'Settle Payroll' : 
               'Settle ALL Payrolls'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {confirmModal.type === 'cancel' ? (
                <>
                  Are you sure you want to revert the payroll for <strong>{confirmModal.employeeName}</strong> back to <strong>Draft</strong>?
                  <br /><br />
                  The salary data will be preserved and can be re-edited.
                </>
              ) : confirmModal.type === 'settle' ? (
                <>
                  Are you sure you want to settle the payroll for <strong>{confirmModal.employeeName}</strong>?
                  <br /><br />
                  Once settled, the values will be locked until manually reverted.
                </>
              ) : (
                <>
                  Are you sure you want to <strong>SETTLE ALL</strong> payrolls for the period of <strong>{format(dateRange.from, "dd MMM")} - {format(dateRange.to, "dd MMM yyyy")}</strong>?
                  <br /><br />
                  This will finalize the records for all staffers in the list. This action is final.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className={cn(
                "rounded-sm",
                confirmModal.type === 'cancel' 
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                  : "bg-green-600 text-white hover:bg-green-700"
              )}
              onClick={async () => {
                setIsSaving(true)
                if (confirmModal.type === 'cancel') {
                  const success = await cancelPayrollItems(
                    [confirmModal.employeeId], 
                    format(dateRange.from, "yyyy-MM-dd"), 
                    format(dateRange.to, "yyyy-MM-dd")
                  )
                  if (success) await fetchAllData()
                } else if (confirmModal.type === 'settle') {
                  if (confirmModal.row) {
                    await handleSave(confirmModal.employeeId, confirmModal.row)
                  }
                  const success = await settlePayrollItems(
                    [confirmModal.employeeId], 
                    format(dateRange.from, "yyyy-MM-dd"), 
                    format(dateRange.to, "yyyy-MM-dd")
                  )
                  if (success) await fetchAllData()
                } else if (confirmModal.type === 'settle_all') {
                  await trulySettleAll()
                }
                setIsSaving(false)
                setConfirmModal(prev => ({ ...prev, open: false }))
              }}
            >
              {confirmModal.type === 'cancel' ? 'Revert to Draft' : 
               confirmModal.type === 'settle' ? 'Confirm Settle' : 
               'Confirm All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
