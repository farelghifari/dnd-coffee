"use client"

import { useState, useEffect, useCallback } from "react"
import { 
  Clock, 
  LogIn, 
  LogOut, 
  Package, 
  PackageOpen, 
  Trash2, 
  ClipboardList,
  ArrowLeft,
  Check,
  AlertTriangle
} from "lucide-react"
import { NFCModal } from "./nfc-modal"
import { StockActionModal } from "./stock-action-modal"
import { StockWidgets } from "./stock-widgets"
import { Button } from "@/components/ui/button"
import { cn, getLocalYYYYMMDD } from "@/lib/utils"
import {
  getInventory,
  addAttendanceLog,
  addStockLog,
  getShiftOnDate,
  getScheduledOvertime,
  hasShiftOnDate,
  addOvertimeRequest,
  getDailyWorkDuration,
  type InventoryItem,
  type OvertimeRequest
} from "@/lib/api/supabase-service"

interface OpsMenuProps {
  onIdle: () => void
  idleTimeout?: number
}

type ActionType = "clock-in" | "clock-out" | "stock-in" | "stock-out" | "waste" | "opname" | null

const menuItems: { id: ActionType; label: string; icon: React.ComponentType<{ className?: string }>; color: string; textColor: string }[] = [
  { id: "clock-in", label: "Clock In", icon: LogIn, color: "bg-[var(--status-healthy)]", textColor: "text-background" },
  { id: "clock-out", label: "Clock Out", icon: LogOut, color: "bg-muted", textColor: "text-foreground" },
  { id: "stock-in", label: "Stock In", icon: Package, color: "bg-foreground", textColor: "text-background" },
  { id: "stock-out", label: "Stock Out", icon: PackageOpen, color: "bg-[var(--status-warning)]", textColor: "text-background" },
  { id: "waste", label: "Waste", icon: Trash2, color: "bg-[var(--status-critical)]", textColor: "text-background" },
  { id: "opname", label: "Stock Opname", icon: ClipboardList, color: "bg-secondary", textColor: "text-foreground" },
]

export function OpsMenu({ onIdle, idleTimeout = 30 }: OpsMenuProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [selectedAction, setSelectedAction] = useState<ActionType>(null)
  const [countdown, setCountdown] = useState(idleTimeout)
  const [lastActivity, setLastActivity] = useState(Date.now())
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null)
  const [showErrorMessage, setShowErrorMessage] = useState<string | null>(null)
  const [showWarningMessage, setShowWarningMessage] = useState<string | null>(null)
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null)
  const [currentEmployeeName, setCurrentEmployeeName] = useState<string | null>(null)
  const [showStockModal, setShowStockModal] = useState(false)
  const [showOTPrompt, setShowOTPrompt] = useState(false)
  const [otPromptMessage, setOTPromptMessage] = useState("")
  const [pendingOTData, setPendingOTData] = useState<{ employeeId: string; employeeName: string; today: string } | null>(null)
  const [pendingStockAction, setPendingStockAction] = useState<"stock-in" | "stock-out" | "waste" | "opname" | null>(null)

  // Load inventory on mount
  useEffect(() => {
    const loadInventory = async () => {
      const data = await getInventory()
      setInventory(data)
    }
    loadInventory()
  }, [])

  const resetCountdown = useCallback(() => {
    setLastActivity(Date.now())
    setCountdown(idleTimeout)
  }, [idleTimeout])

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivity) / 1000)
      const remaining = Math.max(0, idleTimeout - elapsed)
      setCountdown(remaining)

      if (remaining === 0) {
        onIdle()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [lastActivity, idleTimeout, onIdle])

  useEffect(() => {
    const handleActivity = () => resetCountdown()

    window.addEventListener("touchstart", handleActivity)
    window.addEventListener("mousemove", handleActivity)
    window.addEventListener("keydown", handleActivity)

    return () => {
      window.removeEventListener("touchstart", handleActivity)
      window.removeEventListener("mousemove", handleActivity)
      window.removeEventListener("keydown", handleActivity)
    }
  }, [resetCountdown])

  const handleActionSelect = (action: ActionType) => {
    resetCountdown()
    setSelectedAction(action)
  }

  const handleNFCSuccess = async (employeeId: string, employeeName: string) => {
    setCurrentEmployeeId(employeeId)
    setCurrentEmployeeName(employeeName)
    
    if (selectedAction === "clock-in" || selectedAction === "clock-out") {
      // Check if employee has a shift today for clock-in
      const today = getLocalYYYYMMDD()
      const todayShift = await getShiftOnDate(employeeId, today)
      const hasShift = !!todayShift

      if (selectedAction === "clock-in") {
        // 1. Check for scheduled overtime first
        const scheduledOT = await getScheduledOvertime(employeeId, today)
        
        if (scheduledOT) {
          // Pre-approved! Just clock in
          const attendanceLog = await addAttendanceLog({
            employee_id: employeeId,
            employee_name: employeeName,
            type: selectedAction,
            method: 'nfc',
            is_ops_device: true
          })
          
          setShowSuccessMessage(`${employeeName} clocked in for SCHEDULED overtime.`)
          setSelectedAction(null)
          setTimeout(() => {
            setShowSuccessMessage(null)
            setCurrentEmployeeId(null)
            setCurrentEmployeeName(null)
          }, 4000)
          return
        }

        // 2. Check regular shift rules
        if (todayShift) {
          const shiftStart = new Date(`${todayShift.date}T${todayShift.start_time}`)
          const shiftEnd = new Date(`${todayShift.date}T${todayShift.end_time}`)
          if (todayShift.end_time < todayShift.start_time) shiftEnd.setDate(shiftEnd.getDate() + 1)
          
          const now = new Date()
          const earlyMins = Math.round((shiftStart.getTime() - now.getTime()) / 60000)
          
          // Rule 1: Too early - show interactive prompt
          if (earlyMins > 45) {
            const earliestTime = new Date(shiftStart.getTime() - 45 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
            setOTPromptMessage(`Clock-in too early. ${employeeName} can only clock in from ${earliestTime} (45 mins before shift). Do you want to request overtime instead?`)
            setPendingOTData({ employeeId, employeeName, today })
            setShowOTPrompt(true)
            setSelectedAction(null)
            return
          }

          // Rule 3: Post-shift - auto-request OT
          if (now > shiftEnd) {
             const attendanceLog = await addAttendanceLog({
              employee_id: employeeId,
              employee_name: employeeName,
              type: selectedAction,
              method: 'nfc',
              is_ops_device: true
            })
            
            if (attendanceLog) {
              await addOvertimeRequest({
                employee_id: employeeId,
                employee_name: employeeName,
                attendance_log_id: attendanceLog.id,
                request_date: today,
                clock_in_time: new Date().toISOString(),
                status: "pending"
              })
            }
            
            setShowWarningMessage(`${employeeName} clocked in (Post-shift work — Overtime request submitted automatically)`)
            setSelectedAction(null)
            setTimeout(() => {
              setShowWarningMessage(null)
              setCurrentEmployeeId(null)
              setCurrentEmployeeName(null)
            }, 4000)
            return
          }
        }

        // 3. Normal Clock-in Flow (Regular or No-shift OT)
        const attendanceLog = await addAttendanceLog({
          employee_id: employeeId,
          employee_name: employeeName,
          type: selectedAction,
          method: 'nfc',
          is_ops_device: true
        })
        
        const duration = await getDailyWorkDuration(employeeId, today)
        
        if (hasShift) {
          if (duration.isLate) {
            setShowWarningMessage(`${employeeName} clocked in successfully — LATE (> 15 mins)`)
          } else {
            setShowSuccessMessage(`${employeeName} clocked in successfully — Punctual`)
          }
        } else {
          // No shift - create overtime request
          if (attendanceLog) {
            await addOvertimeRequest({
              employee_id: employeeId,
              employee_name: employeeName,
              attendance_log_id: attendanceLog.id,
              request_date: today,
              clock_in_time: new Date().toISOString(),
              status: "pending"
            })
          }
          
          setShowWarningMessage(`${employeeName} clocked in (No shift scheduled — Overtime request submitted for approval)`)
        }
      } else {
        // Clock-out - always allowed
        await addAttendanceLog({
          employee_id: employeeId,
          employee_name: employeeName,
          type: selectedAction,
          method: 'nfc',
          is_ops_device: true
        })
        
        // Calculate regulated duration
        const duration = await getDailyWorkDuration(employeeId, today)
        const regHours = Math.floor(duration.regularMinutes / 60)
        const regMins = duration.regularMinutes % 60
        const otHours = Math.floor(duration.overtimeMinutes / 60)
        const otMins = duration.overtimeMinutes % 60
        
        if (duration.overtimeMinutes > 0) {
          setShowWarningMessage(`${employeeName} clocked out — Regular: ${regHours}h ${regMins}m | OT: ${otHours}h ${otMins}m (Pending Approval)`)
        } else {
          setShowSuccessMessage(`${employeeName} clocked out — Shift Total: ${regHours}h ${regMins}m`)
        }
      }
      
      setSelectedAction(null)
      setTimeout(() => {
        setShowSuccessMessage(null)
        setShowWarningMessage(null)
        setCurrentEmployeeId(null)
        setCurrentEmployeeName(null)
      }, 4000)
    } else {
      // For stock actions, show stock modal
      setPendingStockAction(selectedAction as "stock-in" | "stock-out" | "waste" | "opname")
      setSelectedAction(null)
      setShowStockModal(true)
    }
  }

  const handleStockActionComplete = async (data: { itemId: string; amount: number; notes?: string }) => {
    if (!currentEmployeeId || !currentEmployeeName || !pendingStockAction) return

    const item = inventory.find(i => i.id === data.itemId)
    if (!item) return

    // Validate stock out doesn't exceed available stock
    if ((pendingStockAction === "stock-out" || pendingStockAction === "waste") && data.amount > (item.current_stock ?? 0)) {
      setShowErrorMessage(`Cannot ${pendingStockAction === "stock-out" ? "take out" : "waste"} more than available stock (${item.current_stock ?? 0} ${item.unit})`)
      setTimeout(() => setShowErrorMessage(null), 3000)
      return
    }

    // Map action types to log types
    const logTypeMap: Record<string, "in" | "out" | "waste" | "opname"> = {
      "stock-in": "in",
      "stock-out": "out",
      "waste": "waste",
      "opname": "opname"
    }

    // Add stock log
    await addStockLog({
      item_id: data.itemId,
      item_name: item.name,
      type: logTypeMap[pendingStockAction],
      amount: data.amount,
      employee_id: currentEmployeeId,
      employee_name: currentEmployeeName,
      notes: data.notes
    })

    // Refresh inventory
    const updatedInventory = await getInventory()
    setInventory(updatedInventory)

    const actionLabels: Record<string, string> = {
      "stock-in": "Stock received recorded",
      "stock-out": "Stock usage recorded",
      "waste": "Waste report submitted",
      "opname": "Stock count submitted",
    }

    setShowSuccessMessage(actionLabels[pendingStockAction] || "Action completed")
    setShowStockModal(false)
    setPendingStockAction(null)
    setCurrentEmployeeId(null)
    setCurrentEmployeeName(null)

    setTimeout(() => {
      setShowSuccessMessage(null)
    }, 3000)
  }

  const handleApplyOvertime = async () => {
    if (!pendingOTData) return
    const { employeeId, employeeName, today } = pendingOTData
    
    const attendanceLog = await addAttendanceLog({
      employee_id: employeeId,
      employee_name: employeeName,
      type: "clock-in",
      method: 'nfc',
      is_ops_device: true
    })
    
    if (attendanceLog) {
      await addOvertimeRequest({
        employee_id: employeeId,
        employee_name: employeeName,
        attendance_log_id: attendanceLog.id,
        request_date: today,
        clock_in_time: new Date().toISOString(),
        status: "pending"
      })
    }
    
    setShowOTPrompt(false)
    setPendingOTData(null)
    setShowWarningMessage(`${employeeName} — Overtime request submitted for early clock-in`)
    setTimeout(() => {
      setShowWarningMessage(null)
      setCurrentEmployeeId(null)
      setCurrentEmployeeName(null)
    }, 4000)
  }

  const getActionTitle = (action: ActionType): string => {
    const titles: Record<string, string> = {
      "clock-in": "Clock In",
      "clock-out": "Clock Out",
      "stock-in": "Stock In",
      "stock-out": "Stock Out",
      "waste": "Waste Report",
      "opname": "Stock Opname",
    }
    return titles[action!] || ""
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <button
          onClick={onIdle}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Lock</span>
        </button>

        <div className="text-center">
          <h1 className="text-lg font-light tracking-[0.2em]">DONOTDISTURB</h1>
          <p className="text-xs text-muted-foreground">Operations</p>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className={cn(
            "text-sm font-mono tabular-nums w-6",
            countdown <= 10 && "text-[var(--status-warning)]",
            countdown <= 5 && "text-[var(--status-critical)] animate-pulse"
          )}>
            {countdown}
          </span>
        </div>
      </header>

      {/* Success Message */}
      {showSuccessMessage && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="bg-[var(--status-healthy)] text-background px-12 py-8 rounded-sm flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-200">
            <Check className="w-12 h-12" />
            <span className="text-xl font-medium text-center">{showSuccessMessage}</span>
          </div>
        </div>
      )}

      {/* Warning Message (Overtime) */}
      {showWarningMessage && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="bg-[var(--status-warning)] text-background px-12 py-8 rounded-sm flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-200 max-w-md">
            <AlertTriangle className="w-12 h-12" />
            <span className="text-lg font-medium text-center">{showWarningMessage}</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {showErrorMessage && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="bg-[var(--status-critical)] text-background px-12 py-8 rounded-sm flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-200">
            <AlertTriangle className="w-12 h-12" />
            <span className="text-xl font-medium text-center max-w-xs">{showErrorMessage}</span>
          </div>
        </div>
      )}

      {/* Overtime Prompt Message */}
      {showOTPrompt && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border max-w-md w-full p-8 rounded-sm shadow-2xl flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-200">
            <span className="text-xl font-bold text-center">Overtime Required</span>
            <div className="text-center flex flex-col gap-2">
              <p className="text-[var(--status-critical)] font-semibold">You are more than 45 minutes early for your shift.</p>
              <p className="text-muted-foreground text-sm leading-relaxed">Regular clock-in is only permitted within 45 minutes of your scheduled start time. To clock in now, please submit an **Overtime Request** for admin approval.</p>
            </div>
            <div className="flex gap-4 w-full">
              <Button 
                variant="outline" 
                className="flex-1 rounded-sm py-6 h-auto text-lg" 
                onClick={() => {
                  setShowOTPrompt(false)
                  setPendingOTData(null)
                  setCurrentEmployeeId(null)
                  setCurrentEmployeeName(null)
                }}
              >
                Wait for Shift
              </Button>
              <Button 
                className="flex-1 rounded-sm py-6 h-auto text-lg bg-[var(--status-warning)] hover:bg-[var(--status-warning)]/90 text-background" 
                onClick={handleApplyOvertime}
              >
                Request Overtime
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Menu Buttons */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleActionSelect(item.id)}
                className={cn(
                  "aspect-square rounded-sm flex flex-col items-center justify-center gap-3 md:gap-4 transition-all duration-200 active:scale-95 hover:opacity-90",
                  item.color,
                  item.textColor
                )}
              >
                <item.icon className="w-10 h-10 md:w-14 md:h-14" />
                <span className="text-base md:text-lg font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Widgets Sidebar */}
        <div className="lg:col-span-1">
          <StockWidgets />
        </div>
      </div>

      {/* NFC Modal */}
      <NFCModal
        isOpen={selectedAction !== null && !showStockModal}
        onClose={() => {
          setSelectedAction(null)
          setCurrentEmployeeId(null)
          setCurrentEmployeeName(null)
        }}
        onSuccess={handleNFCSuccess}
        action={`Confirm ${getActionTitle(selectedAction)}`}
        title={getActionTitle(selectedAction)}
      />

      {/* Stock Action Modal */}
      <StockActionModal
        isOpen={showStockModal}
        onClose={() => {
          setShowStockModal(false)
          setPendingStockAction(null)
          setCurrentEmployeeId(null)
          setCurrentEmployeeName(null)
        }}
        onSubmit={handleStockActionComplete}
        actionType={pendingStockAction}
        title={getActionTitle(pendingStockAction)}
        inventory={inventory}
      />
    </div>
  )
}
