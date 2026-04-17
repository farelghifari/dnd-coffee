"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  getActiveEmployees, 
  getShiftAssignments, 
  addShiftAssignment, 
  updateShiftAssignment,
  deleteShiftAssignment,
  getShiftConfigs,
  isWeekend,
  getDayType,
  logActivity,
  type Employee,
  type ShiftAssignment,
  type ShiftConfig
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  GripVertical,
  X,
  Plus,
  Clock
} from "lucide-react"
import { cn, getLocalYYYYMMDD } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// Color palette for shift configs
const SHIFT_COLORS = [
  "bg-amber-500/20 border-amber-500/30 text-amber-700",
  "bg-blue-500/20 border-blue-500/30 text-blue-700",
  "bg-purple-500/20 border-purple-500/30 text-purple-700",
  "bg-green-500/20 border-green-500/30 text-green-700",
  "bg-rose-500/20 border-rose-500/30 text-rose-700",
  "bg-cyan-500/20 border-cyan-500/30 text-cyan-700",
]

export default function SchedulingPage() {
  const { isSuperAdmin } = useAuth()
  
  // Permission check: Super Admin = full access, Admin = read only
  const canEdit = isSuperAdmin()
  
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([])
  const [shiftConfigs, setShiftConfigs] = useState<ShiftConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day // Monday as start of week or Sunday? The template uses 0=Sunday (SHORT_DAYS). Let's use Sunday.
    const sunday = new Date(today.setDate(diff))
    sunday.setHours(0,0,0,0)
    return sunday
  })
  
  const [draggedEmployee, setDraggedEmployee] = useState<string | null>(null)
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{ date: string; dayOfWeek: number } | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")
  
  // Shift selection state
  const [shiftType, setShiftType] = useState<"predefined" | "custom">("predefined")
  const [selectedShiftConfigId, setSelectedShiftConfigId] = useState<string>("")
  const [customStartTime, setCustomStartTime] = useState("09:00")
  const [customEndTime, setCustomEndTime] = useState("17:00")
  const [editingShift, setEditingShift] = useState<ShiftAssignment | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const [employeesData, shiftsData, configsData] = await Promise.all([
        getActiveEmployees(),
        getShiftAssignments(),
        getShiftConfigs()
      ])
      setEmployees(employeesData)
      setShiftAssignments(shiftsData)
      setShiftConfigs(configsData)
      setIsLoading(false)
    }
    fetchData()
  }, [])

  // Generate week dates
  const weekDates = useMemo(() => {
    const dates: { date: Date; dateStr: string; dayOfWeek: number; isCurrentMonth: boolean }[] = []
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart)
      date.setDate(currentWeekStart.getDate() + i)
      dates.push({
        date,
        dateStr: getLocalYYYYMMDD(date),
        dayOfWeek: date.getDay(),
        isCurrentMonth: true // In week view, all are "current"
      })
    }
    return dates
  }, [currentWeekStart])

  // Get shifts for a specific date
  const getShiftsForDate = (dateStr: string) => {
    return shiftAssignments.filter(shift => shift.date === dateStr)
  }

  // Navigate weeks
  const goToPreviousWeek = () => {
    const next = new Date(currentWeekStart)
    next.setDate(currentWeekStart.getDate() - 7)
    setCurrentWeekStart(next)
  }

  const goToNextWeek = () => {
    const next = new Date(currentWeekStart)
    next.setDate(currentWeekStart.getDate() + 7)
    setCurrentWeekStart(next)
  }

  const goToCurrentWeek = () => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day
    const sunday = new Date(today.setDate(diff))
    sunday.setHours(0,0,0,0)
    setCurrentWeekStart(sunday)
  }

  // Drag and drop handlers
  const handleDragStart = (employeeId: string) => {
    setDraggedEmployee(employeeId)
  }

  const handleDragEnd = () => {
    setDraggedEmployee(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (dateStr: string, dayOfWeek: number) => {
    if (draggedEmployee) {
      setSelectedCell({ date: dateStr, dayOfWeek })
      setSelectedEmployeeId(draggedEmployee)
      setIsAddShiftOpen(true)
    }
    setDraggedEmployee(null)
  }

  // Add shift manually
  const handleCellClick = (dateStr: string, dayOfWeek: number) => {
    setSelectedCell({ date: dateStr, dayOfWeek })
    setSelectedEmployeeId("")
    setSelectedShiftConfigId("")
    setEditingShift(null)
    setIsAddShiftOpen(true)
  }

  const handleEditShiftClick = (shift: ShiftAssignment) => {
    setEditingShift(shift)
    setSelectedCell({ date: shift.date, dayOfWeek: shift.day_of_week || 0 })
    setSelectedEmployeeId(shift.employee_id)
    
    if (shift.shift_config_id) {
      setShiftType("predefined")
      setSelectedShiftConfigId(shift.shift_config_id)
    } else {
      setShiftType("custom")
      setCustomStartTime(shift.start_time.substring(0, 5))
      setCustomEndTime(shift.end_time.substring(0, 5))
    }
    
    setIsAddShiftOpen(true)
  }

  const handleSaveShift = async () => {
    if (!selectedCell || !selectedEmployeeId) return
    
    const employee = employees.find(e => e.id === selectedEmployeeId)
    if (!employee) return

    // Determine start and end times based on shift type
    let startTime: string
    let endTime: string
    let shiftConfigId: string | undefined
    let shiftName: string | undefined

    if (shiftType === "predefined") {
      if (!selectedShiftConfigId) return
      const config = shiftConfigs.find(c => c.id === selectedShiftConfigId)
      if (!config) return
      startTime = config.start_time
      endTime = config.end_time
      shiftConfigId = config.id
      shiftName = config.name
    } else {
      startTime = customStartTime
      endTime = customEndTime
    }

    // Validate for full-time employees - max 2 shifts per day
    if (employee.employment_type === "full-time") {
      const existingShiftsByEmployee = shiftAssignments.filter(
        s => s.employee_id === selectedEmployeeId && s.date === selectedCell.date
      )
      if (existingShiftsByEmployee.length >= 2) {
        alert("Full-time employees can only have a maximum of 2 shifts per day.")
        return
      }
    }

    // GENERAL LIMIT: Maximum 5 assignments per day
    const allExistingShiftsForDate = shiftAssignments.filter(
      s => s.date === selectedCell.date
    )
    if (!editingShift && allExistingShiftsForDate.length >= 5) {
      alert("A maximum of 5 assignments is allowed per day.")
      return
    }

    if (editingShift) {
      console.log("[v0] Updating shift assignment:", {
        id: editingShift.id,
        employee_id: selectedEmployeeId,
        employee_name: employee.nickname || employee.name,
        date: selectedCell.date,
        start_time: startTime,
        end_time: endTime,
        shift_config_id: shiftConfigId,
        shift_name: shiftName
      })

      const result = await updateShiftAssignment(editingShift.id, {
        employee_id: selectedEmployeeId,
        employee_name: employee.nickname || employee.name,
        date: selectedCell.date,
        day_of_week: selectedCell.dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        shift_config_id: shiftConfigId,
        shift_name: shiftName
      })
      
      if (result) {
        await logActivity(
          "shift_change",
          "Admin",
          employee.nickname || employee.name,
          `Updated shift on ${selectedCell.date}: ${startTime} - ${endTime}`
        )
      }
    } else {
      console.log("[v0] Adding shift assignment:", {
        employee_id: selectedEmployeeId,
        employee_name: employee.nickname || employee.name,
        date: selectedCell.date,
        start_time: startTime,
        end_time: endTime,
        shift_config_id: shiftConfigId,
        shift_name: shiftName
      })

      const result = await addShiftAssignment({
        employee_id: selectedEmployeeId,
        employee_name: employee.nickname || employee.name,
        date: selectedCell.date,
        day_of_week: selectedCell.dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        shift_config_id: shiftConfigId,
        shift_name: shiftName
      })

      if (result) {
        await logActivity(
          "shift_change",
          "Admin",
          employee.nickname || employee.name,
          `Assigned shift on ${selectedCell.date}: ${startTime} - ${endTime}`
        )
      }
    }

    // Refresh shifts
    const shiftsData = await getShiftAssignments()
    setShiftAssignments(shiftsData)

    setIsAddShiftOpen(false)
    setSelectedCell(null)
    setSelectedEmployeeId("")
    setSelectedShiftConfigId("")
    setEditingShift(null)
    setShiftType("predefined")
    setCustomStartTime("09:00")
    setCustomEndTime("17:00")
  }

  const handleRemoveShift = async (shiftId: string) => {
    const shift = shiftAssignments.find(s => s.id === shiftId)
    await deleteShiftAssignment(shiftId)
    
    // Log the shift removal
    if (shift) {
      await logActivity(
        "shift_change",
        "Admin",
        shift.employee_name || "Unknown",
        `Removed shift on ${shift.date}: ${shift.start_time} - ${shift.end_time}`
      )
    }
    
    const shiftsData = await getShiftAssignments()
    setShiftAssignments(shiftsData)
  }

  // Get time slot info from shift times
  const getTimeSlotInfo = (shift: ShiftAssignment) => {
    // Check if shift has a config id and find matching config
    if (shift.shift_config_id) {
      const configIndex = shiftConfigs.findIndex(c => c.id === shift.shift_config_id)
      if (configIndex >= 0) {
        const config = shiftConfigs[configIndex]
        return { 
          label: config.name, 
          color: SHIFT_COLORS[configIndex % SHIFT_COLORS.length], 
          start: config.start_time, 
          end: config.end_time 
        }
      }
    }
    
    // Try to match by time for backward compatibility
    const configIndex = shiftConfigs.findIndex(c => 
      c.start_time === shift.start_time && c.end_time === shift.end_time
    )
    if (configIndex >= 0) {
      const config = shiftConfigs[configIndex]
      return { 
        label: config.name, 
        color: SHIFT_COLORS[configIndex % SHIFT_COLORS.length], 
        start: config.start_time, 
        end: config.end_time 
      }
    }
    
    // Default color for custom times
    return { 
      label: `Custom`, 
      color: "bg-muted border-border text-muted-foreground", 
      start: shift.start_time, 
      end: shift.end_time 
    }
  }

  // Check if date is today
  const isToday = (dateStr: string) => {
    const today = getLocalYYYYMMDD()
    return dateStr === today
  }

  // Check if date is in the past
  const isPast = (dateStr: string) => {
    const today = getLocalYYYYMMDD()
    return dateStr < today
  }

  // Format week range for header
  const weekRangeStr = useMemo(() => {
    const endDate = new Date(currentWeekStart)
    endDate.setDate(currentWeekStart.getDate() + 6)
    
    const startStr = currentWeekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const endStr = endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    
    return `${startStr} - ${endStr}`
  }, [currentWeekStart])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Shift Scheduling</h1>
          <p className="text-muted-foreground">
            {canEdit ? "Drag employees to assign shifts" : "View shift schedules (Read Only)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousWeek} className="rounded-sm">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToCurrentWeek} className="rounded-sm">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek} className="rounded-sm">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Month Header */}
      <div className="flex items-center justify-center mb-4">
        <div className="flex items-center gap-2 text-lg font-medium">
          <Calendar className="w-5 h-5" />
          {weekRangeStr}
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Employee List - Draggable */}
        <Card className="w-64 rounded-sm shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4" />
              Employees
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
            {employees.map((employee) => (
              <div
                key={employee.id}
                draggable={canEdit}
                onDragStart={() => canEdit && handleDragStart(employee.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-sm border bg-card transition-all",
                  canEdit && "cursor-grab active:cursor-grabbing hover:border-foreground/30 hover:shadow-sm",
                  !canEdit && "cursor-default opacity-70",
                  draggedEmployee === employee.id && "opacity-50 scale-95"
                )}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <div className="w-8 h-8 rounded-sm bg-foreground/5 flex items-center justify-center text-sm font-medium">
                  {(employee.nickname || employee.name || "?").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{employee.nickname || employee.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{employee.employment_type || "full-time"}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Schedule Grid */}
        <Card className="flex-1 rounded-sm overflow-hidden flex flex-col">
          <CardContent className="p-0 flex-1 flex flex-col h-[calc(100vh-280px)]">
            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b shrink-0 bg-muted/20">
              {SHORT_DAYS.map((day, idx) => (
                <div key={day} className={cn("text-center py-2 text-xs font-medium text-muted-foreground border-r last:border-r-0", (idx === 0 || idx === 6) && "text-orange-700 dark:text-orange-300")}>
                  {day}
                </div>
              ))}
            </div>
            
            {/* Week Calendar Grid */}
            <div className="grid grid-cols-7 auto-rows-fr flex-1 overflow-y-auto">
              {weekDates.map(({ date, dateStr, dayOfWeek, isCurrentMonth }) => {
                const isWeekendDay = isWeekend(date)
                const isTodayDate = isToday(dateStr)
                return (
                <div
                  key={dateStr}
                  className={cn(
                    "border-r border-b flex flex-col min-h-[100px]",
                    !isCurrentMonth && "bg-muted/30 opacity-50",
                    isTodayDate && "bg-foreground/5",
                    isWeekendDay && !isTodayDate && isCurrentMonth && "bg-orange-50/50 dark:bg-orange-950/10",
                    isPast(dateStr) && "bg-muted/10 grayscale-[0.2]"
                  )}
                >
                  <div className="p-1 flex justify-end">
                    <span className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-sm",
                      isTodayDate ? "bg-foreground text-background" : isWeekendDay ? "text-orange-800 dark:text-orange-200" : ""
                    )}>
                      {date.getDate()}
                    </span>
                  </div>

                  {/* Shifts Area */}
                  <div
                    className={cn(
                      "flex-1 p-1 space-y-1 overflow-y-auto",
                      canEdit && !isPast(dateStr) && "cursor-pointer"
                    )}
                    onDragOver={canEdit && !isPast(dateStr) ? handleDragOver : undefined}
                    onDrop={canEdit && !isPast(dateStr) ? () => handleDrop(dateStr, dayOfWeek) : undefined}
                    onClick={canEdit && !isPast(dateStr) ? () => handleCellClick(dateStr, dayOfWeek) : undefined}
                  >
                    {getShiftsForDate(dateStr).map((shift) => {
                      const slotInfo = getTimeSlotInfo(shift)
                      return (
                        <div
                          key={shift.id}
                          className={cn(
                            "px-1.5 py-1 rounded-sm border relative group shrink-0",
                            slotInfo.color,
                            canEdit && !isPast(dateStr) && "cursor-pointer hover:brightness-95",
                            isPast(dateStr) && "opacity-70 cursor-default"
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (canEdit && !isPast(dateStr)) handleEditShiftClick(shift)
                          }}
                          title={`${shift.start_time.substring(0,5)} - ${shift.end_time.substring(0,5)} | ${shift.employee_name}`}
                        >
                          {canEdit && !isPast(dateStr) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveShift(shift.id); }}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          <p className="font-semibold text-[10px] truncate leading-tight">{shift.employee_name || "Unknown"}</p>
                          <p className="text-[9px] opacity-80 mt-0.5 truncate leading-none">
                            {shift.start_time.substring(0,5)}-{shift.end_time.substring(0,5)}
                          </p>
                        </div>
                      )
                    })}

                    {getShiftsForDate(dateStr).length === 0 && (
                      <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <Plus className="w-3 h-3 text-muted-foreground/50" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shift Config Legend */}
      <div className="mt-4 flex items-center gap-4 justify-center flex-wrap">
        {shiftConfigs.map((config, index) => (
          <div key={config.id} className="flex items-center gap-2">
            <div className={cn("w-4 h-4 rounded-sm border", SHIFT_COLORS[index % SHIFT_COLORS.length])} />
            <span className="text-xs text-muted-foreground">
              {config.name} ({config.start_time}-{config.end_time})
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm border bg-muted border-border" />
          <span className="text-xs text-muted-foreground">Custom</span>
        </div>
      </div>

      {/* Add Shift Dialog */}
      <Dialog open={isAddShiftOpen} onOpenChange={setIsAddShiftOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-sm">
          <DialogHeader>
            <DialogTitle>{editingShift ? "Edit Shift" : "Add Shift"}</DialogTitle>
            <DialogDescription>
              {selectedCell && (
                <>{editingShift ? "Modify the" : "Assign a"} shift for {DAYS[selectedCell.dayOfWeek]}, {selectedCell.date}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent className="rounded-sm">
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} ({emp.nickname})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

{/* Show employee type info */}
            {selectedEmployeeId && (
              <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded-sm">
                {(() => {
                  const emp = employees.find(e => e.id === selectedEmployeeId)
                  if (emp?.employment_type === "full-time") {
                    return "Full-time employees can only select predefined shifts (max 2 per day)"
                  }
                  return "Part-time employees can use predefined shifts or set custom times"
                })()}
              </div>
            )}

            {/* Shift Type Selection */}
            <div className="space-y-2">
              <Label>Shift Type</Label>
              <RadioGroup 
                value={shiftType} 
                onValueChange={(val) => setShiftType(val as "predefined" | "custom")}
                className="flex gap-4"
                disabled={(() => {
                  const emp = employees.find(e => e.id === selectedEmployeeId)
                  return emp?.employment_type === "full-time"
                })()}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="predefined" id="predefined" />
                  <Label htmlFor="predefined" className="cursor-pointer">Predefined Shift</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value="custom" 
                    id="custom" 
                    disabled={(() => {
                      const emp = employees.find(e => e.id === selectedEmployeeId)
                      return emp?.employment_type === "full-time"
                    })()}
                  />
                  <Label htmlFor="custom" className="cursor-pointer">Custom Time</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Predefined Shift Selection */}
            {shiftType === "predefined" && (
              <div className="space-y-2">
                <Label>Select Shift</Label>
                <div className="grid grid-cols-1 gap-2">
                  {shiftConfigs.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground border rounded-sm">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No shift configurations found</p>
                      <p className="text-xs">Super admin can add shifts in Settings</p>
                    </div>
                  ) : (
                    shiftConfigs.map((config, index) => (
                      <button
                        key={config.id}
                        onClick={() => setSelectedShiftConfigId(config.id)}
                        className={cn(
                          "p-3 rounded-sm border text-left transition-all",
                          selectedShiftConfigId === config.id
                            ? "border-foreground bg-foreground/5"
                            : "border-border hover:border-foreground/30"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{config.name}</span>
                          <Badge variant="outline" className={cn("rounded-sm", SHIFT_COLORS[index % SHIFT_COLORS.length])}>
                            {config.start_time} - {config.end_time}
                          </Badge>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Custom Time Selection */}
            {shiftType === "custom" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customStart">Start Time</Label>
                    <Input
                      id="customStart"
                      type="time"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                      className="rounded-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customEnd">End Time</Label>
                    <Input
                      id="customEnd"
                      type="time"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                      className="rounded-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsAddShiftOpen(false)} className="rounded-sm">
            Cancel
          </Button>
          <Button 
            onClick={handleSaveShift} 
            disabled={!selectedEmployeeId || (shiftType === "predefined" && !selectedShiftConfigId)}
            className="rounded-sm"
            >
              {editingShift ? "Save Changes" : "Add Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
