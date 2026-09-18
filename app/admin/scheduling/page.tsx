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
  Clock,
  Lock
} from "lucide-react"
import { cn, getLocalYYYYMMDD, isShiftLocked, isPastDate } from "@/lib/utils"
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
  const { isSuperAdmin, user } = useAuth()
  
  // Permission check: Super Admin & Admin = full access
  const canEdit = isSuperAdmin() || user?.role === 'admin'
  
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

  // Casual barista state
  const [isCasual, setIsCasual] = useState(false)
  const [casualName, setCasualName] = useState("")

  // Custom Alert State
  const [alertModal, setAlertModal] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: "",
    description: "",
  })

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const [employeesData, shiftsData, configsData] = await Promise.all([
        getActiveEmployees(),
        getShiftAssignments(),
        getShiftConfigs()
      ])
      setEmployees(employeesData.filter(emp => emp.position === 'barista'))
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
    return shiftAssignments
      .filter(shift => 
        shift.date === dateStr && 
        (shift.employee_id === null || employees.some(e => e.id === shift.employee_id))
      )
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
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
    setCasualName("")
    setIsCasual(false)
    setSelectedShiftConfigId("")
    setEditingShift(null)
    setIsAddShiftOpen(true)
  }

  const handleEditShiftClick = (shift: ShiftAssignment) => {
    setEditingShift(shift)
    setSelectedCell({ date: shift.date, dayOfWeek: shift.day_of_week || 0 })
    
    if (shift.employee_id) {
      setSelectedEmployeeId(shift.employee_id)
      setIsCasual(false)
      setCasualName("")
    } else {
      setSelectedEmployeeId("")
      setIsCasual(true)
      setCasualName(shift.employee_name || "")
    }
    
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
    if (!selectedCell) return
    if (!isCasual && !selectedEmployeeId) return
    if (isCasual && !casualName) return
    
    const employee = isCasual ? null : employees.find(e => e.id === selectedEmployeeId)
    if (!isCasual && !employee) return

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

    if (editingShift) {
      console.log("[v0] Updating shift assignment:", {
        id: editingShift.id,
        employee_id: isCasual ? null : selectedEmployeeId,
        employee_name: isCasual ? casualName : (employee?.nickname || employee?.name),
        date: selectedCell.date,
        start_time: startTime,
        end_time: endTime,
        shift_config_id: shiftConfigId,
        shift_name: shiftName
      })

      const result = await updateShiftAssignment(editingShift.id, {
        employee_id: isCasual ? null : selectedEmployeeId,
        employee_name: isCasual ? casualName : (employee?.nickname || employee?.name),
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
          isCasual ? casualName : (employee?.nickname || employee?.name || "Unknown"),
          `Updated shift on ${selectedCell.date}: ${startTime} - ${endTime}`
        )
      }
    } else {
      console.log("[v0] Adding shift assignment:", {
        employee_id: isCasual ? null : selectedEmployeeId,
        employee_name: isCasual ? casualName : (employee?.nickname || employee?.name),
        date: selectedCell.date,
        start_time: startTime,
        end_time: endTime,
        shift_config_id: shiftConfigId,
        shift_name: shiftName
      })

      const result = await addShiftAssignment({
        employee_id: isCasual ? null : selectedEmployeeId,
        employee_name: isCasual ? casualName : (employee?.nickname || employee?.name),
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
          isCasual ? casualName : (employee?.nickname || employee?.name || "Unknown"),
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
    setCasualName("")
    setIsCasual(false)
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
    // Priority: Casual Barista Color
    if (!shift.employee_id) {
      return {
        label: "Casual",
        color: "bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 shadow-sm italic",
        start: shift.start_time,
        end: shift.end_time
      }
    }

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
    <div className="h-full flex flex-col p-0">
      <header className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-3 border-b border-border/50 bg-card/30">
        <div>
          <h1 className="text-xl sm:text-2xl font-light tracking-tight">Shift Scheduling</h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            {canEdit ? "Drag employees to assign shifts" : "View shift schedules (Read Only)"}
          </p>
        </div>

        {/* Month Header - Integrated */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-sm text-xs sm:text-sm font-semibold border border-primary/10 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            {weekRangeStr}
          </div>
        </div>

        <div className="flex items-center justify-center md:justify-end gap-1.5 sm:gap-2">
          <div className="flex items-center bg-muted/50 p-1 rounded-sm border border-border/50">
            <Button variant="ghost" size="sm" onClick={goToPreviousWeek} className="h-7 w-7 p-0 rounded-xs">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToCurrentWeek} className="h-7 px-3 text-[10px] uppercase font-bold tracking-wider rounded-xs">
              Today
            </Button>
            <Button variant="ghost" size="sm" onClick={goToNextWeek} className="h-7 w-7 p-0 rounded-xs">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Employee List - Draggable */}
        <Card className="w-full lg:w-64 rounded-sm shrink-0 shadow-none sm:shadow-sm border-none sm:border bg-transparent sm:bg-card">
          <CardHeader className="pb-2 px-2 sm:px-6 hidden sm:flex">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4" />
              Employees
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto px-2 sm:px-6 py-2 lg:py-4 no-scrollbar lg:max-h-[calc(100vh-350px)]">
            {employees.map((employee) => (
              <div
                key={employee.id}
                draggable={canEdit}
                onDragStart={() => canEdit && handleDragStart(employee.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex items-center gap-2 lg:gap-3 p-2 lg:p-3 rounded-sm border bg-card shrink-0 transition-all",
                  "w-[140px] lg:w-full", // Fixed width on mobile, full on desktop
                  canEdit && "cursor-grab active:cursor-grabbing hover:border-foreground/30 hover:shadow-sm",
                  !canEdit && "cursor-default opacity-70",
                  draggedEmployee === employee.id && "opacity-50 scale-95"
                )}
              >
                <div className="hidden lg:block">
                  <GripVertical className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-sm bg-foreground/5 flex items-center justify-center text-xs lg:text-sm font-medium shrink-0">
                  {(employee.nickname || employee.name || "?").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] lg:text-sm font-medium truncate leading-tight">{employee.nickname || employee.name}</p>
                  <p className="hidden lg:block text-[10px] text-muted-foreground capitalize">{employee.employment_type || "full-time"}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Schedule Grid */}
        <Card className="flex-1 rounded-sm overflow-hidden flex flex-col border-none sm:border shadow-none sm:shadow-sm bg-transparent sm:bg-card">
          <CardContent className="p-0 flex-1 flex flex-col min-h-[350px] sm:min-h-[450px] lg:h-[calc(100vh-280px)]">
            <div className="flex-1 flex flex-col overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20">
              <div className="min-w-[850px] flex-1 flex flex-col bg-card border rounded-sm sm:border-none sm:rounded-none">
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
                const isTodayDate = getLocalYYYYMMDD() === dateStr
                const isPast = isPastDate(dateStr)

                return (
                <div
                  key={dateStr}
                  className={cn(
                    "border-r border-b flex flex-col min-h-[100px]",
                    !isCurrentMonth && "bg-muted/30 opacity-50",
                    isTodayDate && "bg-foreground/5",
                    isWeekendDay && !isTodayDate && isCurrentMonth && "bg-orange-50/50 dark:bg-orange-950/10",
                    isPast && "bg-muted/10 grayscale-[0.2]"
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
                      canEdit && !isPast && "cursor-pointer"
                    )}
                    onDragOver={canEdit && !isPast ? handleDragOver : undefined}
                    onDrop={canEdit && !isPast ? () => handleDrop(dateStr, dayOfWeek) : undefined}
                    onClick={canEdit && !isPastDate(dateStr) ? () => handleCellClick(dateStr, dayOfWeek) : undefined}
                  >
                    {getShiftsForDate(dateStr).map((shift) => {
                      const slotInfo = getTimeSlotInfo(shift)
                      const isLocked = isShiftLocked(shift.date, shift.start_time)
                      
                      return (
                        <div
                          key={shift.id}
                          className={cn(
                            "px-1.5 py-1 rounded-sm border relative group shrink-0",
                            isLocked ? "bg-muted/30 border-muted-foreground/20 grayscale" : slotInfo.color,
                            canEdit && !isLocked && !isPastDate(dateStr) && "cursor-pointer hover:brightness-95",
                            (isLocked || isPastDate(dateStr)) && "cursor-default"
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isLocked) return
                            if (canEdit && !isPastDate(dateStr)) handleEditShiftClick(shift)
                          }}
                          title={`${shift.start_time.substring(0,5)} - ${shift.end_time.substring(0,5)} | ${shift.employee_name}${isLocked ? " (Locked)" : ""}`}
                        >
                          {isLocked && (
                            <Lock className="w-2.5 h-2.5 absolute top-1 right-1 text-muted-foreground" />
                          )}
                          
                          {canEdit && !isLocked && !isPastDate(dateStr) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveShift(shift.id); }}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity flex items-center justify-center z-10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          <p className={cn("font-semibold text-[10px] truncate leading-tight", isLocked && "text-muted-foreground")}>
                            {shift.employee_name || "Unknown"}
                          </p>
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
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shift Config Legend */}
      <div className="mt-auto pt-4 border-t border-border flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">Shift Legend</p>
        <div className="flex items-center gap-4 justify-start sm:justify-center overflow-x-auto pb-2 px-2 no-scrollbar">
          <div className="flex items-center gap-4 shrink-0">
            {[...shiftConfigs]
              .sort((a, b) => {
                const aIsFT = a.name.includes("Full-time")
                const bIsFT = b.name.includes("Full-time")
                if (aIsFT && !bIsFT) return -1
                if (!aIsFT && bIsFT) return 1
                return a.start_time.localeCompare(b.start_time)
              })
              .map((config) => {
                const configIndex = shiftConfigs.findIndex(c => c.id === config.id)
                return (
                  <div key={config.id} className="flex items-center gap-1.5 whitespace-nowrap">
                    <div className={cn("w-3 h-3 rounded-xs border", SHIFT_COLORS[configIndex % SHIFT_COLORS.length])} />
                    <span className="text-[10px] text-muted-foreground">
                      {config.name.split(':')[0]} ({config.start_time.substring(0, 5)})
                    </span>
                  </div>
                )
              })
            }
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <div className="w-3 h-3 rounded-xs border bg-muted border-border" />
              <span className="text-[10px] text-muted-foreground">Custom</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Shift Dialog */}
      <Dialog open={isAddShiftOpen} onOpenChange={setIsAddShiftOpen}>
        <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-y-auto rounded-sm">
          <DialogHeader>
            <DialogTitle>{editingShift ? "Edit Shift" : "Add Shift"}</DialogTitle>
            <DialogDescription>
              {selectedCell && (
                <>{editingShift ? "Modify the" : "Assign a"} shift for {DAYS[selectedCell.dayOfWeek]}, {selectedCell.date}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Casual Barista Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-sm border border-dashed">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Casual Barista</Label>
                <p className="text-[10px] text-muted-foreground">From outside DND (Not in payroll)</p>
              </div>
              <Button 
                variant={isCasual ? "default" : "outline"} 
                size="sm" 
                className="h-8 text-xs rounded-sm"
                onClick={() => {
                  setIsCasual(!isCasual)
                  if (!isCasual) {
                    setSelectedEmployeeId("")
                    setShiftType("custom") // Default to manual for casual
                  } else {
                    setCasualName("")
                    setShiftType("predefined")
                  }
                }}
              >
                {isCasual ? "Casual Selected" : "Set as Casual"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>{isCasual ? "Barista Name" : "Employee"}</Label>
              {isCasual ? (
                <Input 
                  placeholder="Enter barista name..." 
                  value={casualName} 
                  onChange={(e) => setCasualName(e.target.value)}
                  className="rounded-sm"
                />
              ) : (
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
              )}
            </div>

{/* Show employee type info */}
            {selectedEmployeeId && (
              <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded-sm">
                {(() => {
                  const emp = employees.find(e => e.id === selectedEmployeeId)
                  return emp?.employment_type === "full-time" 
                    ? "Full-time employee: Can use predefined shifts or set custom times"
                    : "Part-time employee: Can use predefined shifts or set custom times"
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
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="predefined" id="predefined" />
                  <Label htmlFor="predefined" className="cursor-pointer">Predefined Shift</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom" className="cursor-pointer">Custom Time</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Predefined Shift Selection with Grouping */}
            {shiftType === "predefined" && (
              <div className="space-y-4">
                {["Full-time", "Part-time"].map((type) => {
                  // Get unique configs by name to avoid duplicates
                  const uniqueConfigs = Array.from(
                    new Map(
                      shiftConfigs
                        .filter(c => {
                          const isMatch = c.name.includes(type) || 
                            (type === "Full-time" && c.name.startsWith("FT:")) ||
                            (type === "Part-time" && c.name.startsWith("PT:"))
                          return isMatch
                        })
                        .map(c => {
                          // Extract display label for uniqueness check if using prefixed format
                          let displayLabel = c.name
                          if (c.name.startsWith("FT:") || c.name.startsWith("PT:")) {
                            displayLabel = c.name.split(":").slice(2).join(":")
                          }
                          return [displayLabel, c]
                        })
                    ).values()
                  ).sort((a, b) => a.start_time.localeCompare(b.start_time))

                  if (uniqueConfigs.length === 0) return null
                  
                  return (
                    <div key={type} className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                        {type} Shifts
                      </Label>
                      <div className="grid grid-cols-1 gap-2">
                        {uniqueConfigs.map((config) => {
                          const configIndex = shiftConfigs.findIndex(c => c.id === config.id)
                          return (
                            <button
                              key={config.id}
                              onClick={() => setSelectedShiftConfigId(config.id)}
                              className={cn(
                                "p-3 rounded-sm border text-left transition-all",
                                selectedShiftConfigId === config.id
                                  ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm" 
                                  : "bg-card hover:bg-muted border-border"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold tracking-tight">
                                  {config.name.includes(":") ? config.name.split(":").slice(2).join(":") : config.name}
                                </span>
                                <Badge variant="secondary" className="font-mono text-[10px] rounded-sm bg-muted-foreground/10 text-muted-foreground border-none">
                                  {config.start_time} - {config.end_time}
                                </Badge>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                
                {shiftConfigs.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground border border-dashed rounded-sm">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No shift configurations found</p>
                    <p className="text-xs">Super admin can add shifts in Settings</p>
                  </div>
                )}
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
            disabled={(!isCasual && !selectedEmployeeId) || (isCasual && !casualName) || (shiftType === "predefined" && !selectedShiftConfigId)}
            className="rounded-sm"
            >
              {editingShift ? "Save Changes" : "Add Shift"}
            </Button>
            {editingShift && (
              <Button 
                variant="destructive" 
                onClick={() => {
                  handleRemoveShift(editingShift.id)
                  setIsAddShiftOpen(false)
                }}
                className="rounded-sm"
              >
                Delete Shift
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global Alert Dialog */}
      <AlertDialog open={alertModal.open} onOpenChange={(open) => setAlertModal(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{alertModal.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {alertModal.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="rounded-sm" onClick={() => setAlertModal(prev => ({ ...prev, open: false }))}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
