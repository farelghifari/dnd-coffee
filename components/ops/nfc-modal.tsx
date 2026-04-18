"use client"

import { useEffect, useRef, useState } from "react"
import { X, CreditCard, Check, AlertCircle } from "lucide-react"
import { getEmployeeByNFC, getActiveEmployees, type Employee } from "@/lib/api/supabase-service"
import { cn } from "@/lib/utils"

interface NFCModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (employeeId: string, employeeName: string) => void
  action: string
  title: string
}

export function NFCModal({ isOpen, onClose, onSuccess, action, title }: NFCModalProps) {
  const [nfcInput, setNfcInput] = useState("")
  const [status, setStatus] = useState<"waiting" | "success" | "error">("waiting")
  const [message, setMessage] = useState("")
  const [activeEmployeesWithNFC, setActiveEmployeesWithNFC] = useState<Employee[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Load active employees with NFC for demo hints
  useEffect(() => {
    const loadEmployees = async () => {
      const employees = await getActiveEmployees()
      setActiveEmployeesWithNFC(employees.filter(emp => emp.nfc_uid))
    }
    if (isOpen) {
      loadEmployees()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setNfcInput("")
      setStatus("waiting")
      setMessage("")
      setIsProcessing(false) // CRITICAL FIX: Reset processing state on reopen
      
      const focusInput = () => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus()
        }
      }

      // Initial focus
      setTimeout(focusInput, 100)

      // Keep focus: refocus every 2 seconds if lost
      const interval = setInterval(focusInput, 2000)

      // Refocus on click anywhere in the window
      const handleWindowClick = () => focusInput()
      window.addEventListener("click", handleWindowClick)

      return () => {
        clearInterval(interval)
        window.removeEventListener("click", handleWindowClick)
        setIsProcessing(false) // Reset on unmount/close
      }
    }
  }, [isOpen])

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const processNFCLookup = async (value: string) => {
    if (isProcessing) return
    setIsProcessing(true)
    
    try {
      // Clean the UID: trim whitespace, remove line breaks
      const cleanUID = value.trim().replace(/[\r\n]/g, '')
      
      if (cleanUID.length < 4) {
        setIsProcessing(false)
        return
      }
      
      // Query Supabase for employee with this NFC
      const employee = await getEmployeeByNFC(cleanUID)
      
      if (employee) {
        setStatus("success")
        setMessage(`Welcome, ${employee.nickname || employee.name}!`)
        setTimeout(() => {
          onSuccess(employee.id, employee.nickname || employee.name)
        }, 1500)
      } else {
        setStatus("error")
        setMessage("Card not recognized. Please try again.")
        setTimeout(() => {
          if (isOpen) {
            setStatus("waiting")
            setMessage("")
            setNfcInput("")
            setIsProcessing(false)
            inputRef.current?.focus()
          }
        }, 2000)
      }
    } catch (error) {
      console.error("NFC Lookup Error:", error)
      setStatus("error")
      setMessage("System error. Please try again.")
      setTimeout(() => {
        if (isOpen) {
          setStatus("waiting")
          setMessage("")
          setNfcInput("")
          setIsProcessing(false)
          inputRef.current?.focus()
        }
      }, 2000)
    }
  }

  const handleNFCInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setNfcInput(value)
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Auto-trigger lookup after input completes (NFC readers input quickly)
    // 50ms delay is enough for modern readers and feels more responsive
    if (value.length >= 4) {
      timeoutRef.current = setTimeout(() => {
        processNFCLookup(value)
      }, 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Also trigger on Enter key as fallback
    if (e.key === "Enter" && e.currentTarget.value.length >= 4) {
      e.preventDefault()
      const value = e.currentTarget.value
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      processNFCLookup(value)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-6 cursor-pointer"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="w-full max-w-lg">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-3 rounded-full bg-muted hover:bg-muted/80 transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Content */}
        <div className="text-center">
          <h2 className="text-2xl font-light mb-2">{title}</h2>
          <p className="text-muted-foreground mb-12">{action}</p>

          {/* NFC Icon */}
          <div
            className={cn(
              "w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-8 transition-colors",
              status === "waiting" && "bg-muted animate-pulse",
              status === "success" && "bg-[var(--status-healthy)]/20",
              status === "error" && "bg-[var(--status-critical)]/20"
            )}
          >
            {status === "waiting" && (
              <div className="relative">
                <CreditCard className="w-16 h-16 text-muted-foreground" />
                {/* Focus indicator dot */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--status-healthy)] rounded-full animate-pulse border-2 border-background" />
              </div>
            )}
            {status === "success" && (
              <Check className="w-16 h-16 text-[var(--status-healthy)]" />
            )}
            {status === "error" && (
              <AlertCircle className="w-16 h-16 text-[var(--status-critical)]" />
            )}
          </div>

          {/* Status message */}
          <p
            className={cn(
              "text-xl",
              status === "waiting" && "text-muted-foreground",
              status === "success" && "text-[var(--status-healthy)]",
              status === "error" && "text-[var(--status-critical)]"
            )}
          >
            {status === "waiting" ? "Tap your NFC card" : message}
          </p>

          {/* Focus-magnet input for NFC reader keyboard emulation */}
          <input
            ref={inputRef}
            type="text"
            value={nfcInput}
            onChange={handleNFCInput}
            onKeyDown={handleKeyDown}
            className="absolute opacity-0 pointer-events-none w-1 h-1"
            aria-label="NFC card input"
            autoComplete="off"
            disabled={isProcessing || status !== "waiting"}
          />

          {/* Demo hint */}
          <div className="mt-12">
            <p className="text-sm text-muted-foreground mb-3">
              Demo: Click a name to simulate a scan
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
              {activeEmployeesWithNFC.map(emp => (
                <button
                  key={emp.id}
                  onClick={(e) => {
                    e.stopPropagation() // Prevent modal refocus trigger
                    setNfcInput(emp.nfc_uid || "")
                    if (emp.nfc_uid) {
                      processNFCLookup(emp.nfc_uid)
                    }
                  }}
                  className="px-3 py-1 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-mono rounded-full transition-colors border border-border"
                >
                  {emp.nickname || emp.name}
                </button>
              ))}
              {activeEmployeesWithNFC.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Loading demo data...</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
