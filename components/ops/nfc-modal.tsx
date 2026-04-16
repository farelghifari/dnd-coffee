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
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const processNFCLookup = async (value: string) => {
    if (isProcessing) return
    setIsProcessing(true)
    
    // Clean the UID: trim whitespace, remove line breaks, convert to lowercase
    const cleanUID = value.trim().replace(/[\r\n]/g, '').toLowerCase()
    
    if (cleanUID.length < 4) {
      setIsProcessing(false)
      return
    }
    
    // Query Supabase for employee with this NFC
    const employee = await getEmployeeByNFC(cleanUID)
    
    if (employee) {
      setStatus("success")
      setMessage(`Welcome, ${employee.nickname}!`)
      setTimeout(() => {
        onSuccess(employee.id, employee.nickname || employee.name)
      }, 1500)
    } else {
      setStatus("error")
      setMessage("Card not recognized. Please try again.")
      setTimeout(() => {
        setStatus("waiting")
        setMessage("")
        setNfcInput("")
        setIsProcessing(false)
        inputRef.current?.focus()
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
    // 150ms delay ensures all characters are captured
    if (value.length >= 4) {
      timeoutRef.current = setTimeout(() => {
        processNFCLookup(value)
      }, 150)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Also trigger on Enter key as fallback
    if (e.key === "Enter" && nfcInput.length >= 4) {
      e.preventDefault()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      processNFCLookup(nfcInput)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-6">
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
              <CreditCard className="w-16 h-16 text-muted-foreground" />
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

          {/* Hidden input for NFC reader keyboard emulation */}
          <input
            ref={inputRef}
            type="text"
            value={nfcInput}
            onChange={handleNFCInput}
            onKeyDown={handleKeyDown}
            className="sr-only"
            aria-label="NFC card input"
            autoComplete="off"
            disabled={isProcessing || status !== "waiting"}
          />

          {/* Demo hint */}
          <p className="text-sm text-muted-foreground mt-12">
            Demo: Type one of these UIDs and press Enter:
            <br />
            <span className="font-mono text-xs mt-2 inline-block">
              {activeEmployeesWithNFC.map(emp => `${emp.nfc_uid} (${emp.nickname})`).join(" | ") || "Loading..."}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
