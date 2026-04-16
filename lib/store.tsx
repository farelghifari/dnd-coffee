"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { 
  inventory as initialInventory, 
  employees as initialEmployees, 
  stockLogs as initialStockLogs, 
  attendanceLogs as initialAttendanceLogs,
  users as initialUsers,
  menuItems as initialMenuItems,
  shiftAssignments as initialShiftAssignments,
  overtimeRequests as initialOvertimeRequests,
  type InventoryItem,
  type Employee,
  type StockLog,
  type AttendanceLog,
  type User,
  type MenuItem,
  type ShiftAssignment,
  type OvertimeRequest
} from "./data"

// Storage keys
const STORAGE_KEYS = {
  inventory: "dnd_inventory",
  employees: "dnd_employees",
  stockLogs: "dnd_stock_logs",
  attendanceLogs: "dnd_attendance_logs",
  users: "dnd_users",
  menuItems: "dnd_menu_items",
  shiftAssignments: "dnd_shift_assignments",
  overtimeRequests: "dnd_overtime_requests"
}

// Helper to safely get from localStorage
function getStoredData<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored) as T
    }
  } catch (e) {
    console.error(`Error loading ${key} from localStorage:`, e)
  }
  return fallback
}

// Helper to safely set to localStorage
function setStoredData<T>(key: string, data: T): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.error(`Error saving ${key} to localStorage:`, e)
  }
}

interface StoreContextType {
  // Data
  inventory: InventoryItem[]
  employees: Employee[]
  stockLogs: StockLog[]
  attendanceLogs: AttendanceLog[]
  users: User[]
  menuItems: MenuItem[]
  shiftAssignments: ShiftAssignment[]
  overtimeRequests: OvertimeRequest[]

  // Inventory Actions
  updateInventory: (itemId: string, amount: number, type: "in" | "out" | "waste" | "opname") => void
  addInventoryItem: (item: Omit<InventoryItem, "id" | "lastUpdated">) => void
  
  // Stock Log Actions
  addStockLog: (log: Omit<StockLog, "id" | "timestamp">) => void
  
  // Attendance Actions
  addAttendanceLog: (employeeId: string, employeeName: string, type: "clock-in" | "clock-out") => AttendanceLog
  getOnShiftEmployees: () => Employee[]
  
  // Employee Actions
  addEmployee: (employee: Omit<Employee, "id">) => void
  updateEmployee: (id: string, updates: Partial<Employee>) => void
  toggleEmployeeStatus: (id: string) => void
  assignNFC: (id: string, nfcUid: string) => void
  findEmployeeByNFC: (nfcUid: string) => Employee | undefined
  
  // User Actions
  addUser: (user: User) => void
  
  // Menu Actions
  addMenuItem: (item: Omit<MenuItem, "id">) => void
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => void
  deleteMenuItem: (id: string) => void

  // Shift Assignment Actions
  addShiftAssignment: (assignment: Omit<ShiftAssignment, "id">) => void
  updateShiftAssignment: (id: string, updates: Partial<ShiftAssignment>) => void
  deleteShiftAssignment: (id: string) => void
  getShiftsByDate: (date: string) => ShiftAssignment[]
  getShiftsByEmployee: (employeeId: string) => ShiftAssignment[]
  getEmployeeShiftForDate: (employeeId: string, date: string) => ShiftAssignment | undefined
  hasShiftOnDate: (employeeId: string, date: string) => boolean

  // Overtime Actions
  addOvertimeRequest: (request: Omit<OvertimeRequest, "id">) => void
  approveOvertimeRequest: (id: string, reviewerName: string) => void
  rejectOvertimeRequest: (id: string, reviewerName: string, notes?: string) => void
  getPendingOvertimeRequests: () => OvertimeRequest[]
  
  // Helper functions
  getStockHealth: (item: InventoryItem) => "healthy" | "warning" | "critical"
  getDaysRemaining: (item: InventoryItem) => number
  getOverallStockHealth: () => number
  getLowStockItems: () => (InventoryItem & { daysRemaining: number })[]
  getOperationalCapacity: () => number
  getPurchaseRecommendations: () => { item: InventoryItem; recommendedQty: number; coverageDays: number }[]
  getTodayAttendance: () => AttendanceLog[]
  getAttendanceByDate: (date: string) => AttendanceLog[]
  getStockLogsByDate: (date: string) => StockLog[]
}

const StoreContext = createContext<StoreContextType | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false)
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory)
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [stockLogs, setStockLogs] = useState<StockLog[]>(initialStockLogs)
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>(initialAttendanceLogs)
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems)
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>(initialShiftAssignments)
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>(initialOvertimeRequests)

  // Hydrate state from localStorage on mount
  useEffect(() => {
    setInventory(getStoredData(STORAGE_KEYS.inventory, initialInventory))
    setEmployees(getStoredData(STORAGE_KEYS.employees, initialEmployees))
    setStockLogs(getStoredData(STORAGE_KEYS.stockLogs, initialStockLogs))
    setAttendanceLogs(getStoredData(STORAGE_KEYS.attendanceLogs, initialAttendanceLogs))
    setUsers(getStoredData(STORAGE_KEYS.users, initialUsers))
    setMenuItems(getStoredData(STORAGE_KEYS.menuItems, initialMenuItems))
    setShiftAssignments(getStoredData(STORAGE_KEYS.shiftAssignments, initialShiftAssignments))
    setOvertimeRequests(getStoredData(STORAGE_KEYS.overtimeRequests, initialOvertimeRequests))
    setIsHydrated(true)
  }, [])

  // Persist state changes to localStorage
  useEffect(() => {
    if (!isHydrated) return
    setStoredData(STORAGE_KEYS.inventory, inventory)
  }, [inventory, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    setStoredData(STORAGE_KEYS.employees, employees)
  }, [employees, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    setStoredData(STORAGE_KEYS.stockLogs, stockLogs)
  }, [stockLogs, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    setStoredData(STORAGE_KEYS.attendanceLogs, attendanceLogs)
  }, [attendanceLogs, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    setStoredData(STORAGE_KEYS.users, users)
  }, [users, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    setStoredData(STORAGE_KEYS.menuItems, menuItems)
  }, [menuItems, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    setStoredData(STORAGE_KEYS.shiftAssignments, shiftAssignments)
  }, [shiftAssignments, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    setStoredData(STORAGE_KEYS.overtimeRequests, overtimeRequests)
  }, [overtimeRequests, isHydrated])

  // Generate unique IDs
  const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Get current timestamp
  const getCurrentTimestamp = () => new Date().toISOString()

  // Update inventory based on action
  const updateInventory = useCallback((itemId: string, amount: number, type: "in" | "out" | "waste" | "opname") => {
    setInventory(prev => prev.map(item => {
      if (item.id !== itemId) return item
      
      let newStock = item.currentStock
      switch (type) {
        case "in":
          newStock += amount
          break
        case "out":
        case "waste":
          newStock = Math.max(0, newStock - amount)
          break
        case "opname":
          newStock = amount // Set to exact count
          break
      }
      
      return {
        ...item,
        currentStock: newStock,
        lastUpdated: getCurrentTimestamp()
      }
    }))
  }, [])

  // Add stock log
  const addStockLog = useCallback((log: Omit<StockLog, "id" | "timestamp">) => {
    const newLog: StockLog = {
      ...log,
      id: generateId("log"),
      timestamp: getCurrentTimestamp()
    }
    setStockLogs(prev => [newLog, ...prev])
    
    // Also update inventory
    updateInventory(log.itemId, log.amount, log.type)
  }, [updateInventory])

  // Add inventory item
  const addInventoryItem = useCallback((item: Omit<InventoryItem, "id" | "lastUpdated">) => {
    const newItem: InventoryItem = {
      ...item,
      id: generateId(item.category),
      lastUpdated: getCurrentTimestamp()
    }
    setInventory(prev => [...prev, newItem])
  }, [])

  // Add attendance log
  const addAttendanceLog = useCallback((employeeId: string, employeeName: string, type: "clock-in" | "clock-out"): AttendanceLog => {
    const newLog: AttendanceLog = {
      id: generateId("att"),
      employeeId,
      employeeName,
      type,
      timestamp: getCurrentTimestamp()
    }
    setAttendanceLogs(prev => [newLog, ...prev])
    return newLog
  }, [])

  // Get currently on-shift employees
  const getOnShiftEmployees = useCallback(() => {
    const today = new Date().toISOString().split("T")[0]
    const todayLogs = attendanceLogs.filter(log => log.timestamp.startsWith(today))
    const clockedIn = new Set<string>()

    // Process in chronological order
    const sortedLogs = [...todayLogs].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    sortedLogs.forEach(log => {
      if (log.type === "clock-in") {
        clockedIn.add(log.employeeId)
      } else {
        clockedIn.delete(log.employeeId)
      }
    })

    return employees.filter(emp => clockedIn.has(emp.id))
  }, [attendanceLogs, employees])

  // Add employee
  const addEmployee = useCallback((employee: Omit<Employee, "id">) => {
    const newEmployee: Employee = {
      ...employee,
      id: generateId("emp")
    }
    setEmployees(prev => [...prev, newEmployee])
  }, [])

  // Update employee
  const updateEmployee = useCallback((id: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(emp => 
      emp.id === id ? { ...emp, ...updates } : emp
    ))
  }, [])

  // Toggle employee status
  const toggleEmployeeStatus = useCallback((id: string) => {
    setEmployees(prev => prev.map(emp => 
      emp.id === id 
        ? { ...emp, status: emp.status === "active" ? "inactive" : "active" } 
        : emp
    ))
  }, [])

  // Assign NFC
  const assignNFC = useCallback((id: string, nfcUid: string) => {
    setEmployees(prev => prev.map(emp => 
      emp.id === id ? { ...emp, nfc_uid: nfcUid.toUpperCase() } : emp
    ))
  }, [])

  // Find employee by NFC
  const findEmployeeByNFC = useCallback((nfcUid: string) => {
    return employees.find(emp => emp.nfc_uid === nfcUid && emp.status === "active")
  }, [employees])

  // Add user
  const addUser = useCallback((user: User) => {
    setUsers(prev => [...prev, user])
  }, [])

  // Add menu item
  const addMenuItem = useCallback((item: Omit<MenuItem, "id">) => {
    const newItem: MenuItem = {
      ...item,
      id: generateId("menu")
    }
    setMenuItems(prev => [...prev, newItem])
  }, [])

  // Update menu item
  const updateMenuItem = useCallback((id: string, updates: Partial<MenuItem>) => {
    setMenuItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ))
  }, [])

  // Delete menu item
  const deleteMenuItem = useCallback((id: string) => {
    setMenuItems(prev => prev.filter(item => item.id !== id))
  }, [])

  // Add shift assignment
  const addShiftAssignment = useCallback((assignment: Omit<ShiftAssignment, "id">) => {
    const newAssignment: ShiftAssignment = {
      ...assignment,
      id: generateId("shift")
    }
    setShiftAssignments(prev => [...prev, newAssignment])
  }, [])

  // Update shift assignment
  const updateShiftAssignment = useCallback((id: string, updates: Partial<ShiftAssignment>) => {
    setShiftAssignments(prev => prev.map(shift => 
      shift.id === id ? { ...shift, ...updates } : shift
    ))
  }, [])

  // Delete shift assignment
  const deleteShiftAssignment = useCallback((id: string) => {
    setShiftAssignments(prev => prev.filter(shift => shift.id !== id))
  }, [])

  // Get shifts by date
  const getShiftsByDate = useCallback((date: string) => {
    return shiftAssignments.filter(shift => shift.date === date)
  }, [shiftAssignments])

  // Get shifts by employee
  const getShiftsByEmployee = useCallback((employeeId: string) => {
    return shiftAssignments.filter(shift => shift.employeeId === employeeId)
  }, [shiftAssignments])

  // Get employee shift for a specific date
  const getEmployeeShiftForDate = useCallback((employeeId: string, date: string) => {
    return shiftAssignments.find(shift => shift.employeeId === employeeId && shift.date === date)
  }, [shiftAssignments])

  // Check if employee has shift on date
  const hasShiftOnDate = useCallback((employeeId: string, date: string) => {
    return shiftAssignments.some(shift => shift.employeeId === employeeId && shift.date === date)
  }, [shiftAssignments])

  // Add overtime request
  const addOvertimeRequest = useCallback((request: Omit<OvertimeRequest, "id">) => {
    const newRequest: OvertimeRequest = {
      ...request,
      id: generateId("ot")
    }
    setOvertimeRequests(prev => [...prev, newRequest])
  }, [])

  // Approve overtime request
  const approveOvertimeRequest = useCallback((id: string, reviewerName: string) => {
    setOvertimeRequests(prev => prev.map(req => 
      req.id === id ? { 
        ...req, 
        status: "approved" as const, 
        reviewedBy: reviewerName, 
        reviewedAt: getCurrentTimestamp() 
      } : req
    ))
  }, [])

  // Reject overtime request
  const rejectOvertimeRequest = useCallback((id: string, reviewerName: string, notes?: string) => {
    setOvertimeRequests(prev => prev.map(req => 
      req.id === id ? { 
        ...req, 
        status: "rejected" as const, 
        reviewedBy: reviewerName, 
        reviewedAt: getCurrentTimestamp(),
        notes 
      } : req
    ))
  }, [])

  // Get pending overtime requests
  const getPendingOvertimeRequests = useCallback(() => {
    return overtimeRequests.filter(req => req.status === "pending")
  }, [overtimeRequests])

  // Helper: Get stock health
  const getStockHealth = useCallback((item: InventoryItem): "healthy" | "warning" | "critical" => {
    const daysRemaining = item.currentStock / item.dailyUsage
    if (daysRemaining <= 1) return "critical"
    if (daysRemaining <= 3) return "warning"
    return "healthy"
  }, [])

  // Helper: Get days remaining
  const getDaysRemaining = useCallback((item: InventoryItem): number => {
    return Math.round((item.currentStock / item.dailyUsage) * 10) / 10
  }, [])

  // Helper: Get overall stock health
  const getOverallStockHealth = useCallback((): number => {
    const healthyItems = inventory.filter(item => getStockHealth(item) === "healthy").length
    return Math.round((healthyItems / inventory.length) * 100)
  }, [inventory, getStockHealth])

  // Helper: Get low stock items
  const getLowStockItems = useCallback(() => {
    return inventory
      .map(item => ({ ...item, daysRemaining: getDaysRemaining(item) }))
      .filter(item => item.daysRemaining <= 5)
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
  }, [inventory, getDaysRemaining])

  // Helper: Get operational capacity
  const getOperationalCapacity = useCallback((): number => {
    const criticalItems = inventory.filter(item => getStockHealth(item) === "critical")
    if (criticalItems.length > 0) return 1
    
    const minDays = Math.min(...inventory.map(item => getDaysRemaining(item)))
    return Math.round(minDays * 10) / 10
  }, [inventory, getStockHealth, getDaysRemaining])

  // Helper: Get purchase recommendations
  const getPurchaseRecommendations = useCallback(() => {
    return inventory
      .filter(item => getDaysRemaining(item) <= 7)
      .map(item => {
        const coverageDays = 7
        const recommendedQty = Math.ceil(item.dailyUsage * coverageDays)
        return { item, recommendedQty, coverageDays }
      })
      .sort((a, b) => getDaysRemaining(a.item) - getDaysRemaining(b.item))
  }, [inventory, getDaysRemaining])

  // Helper: Get today's attendance
  const getTodayAttendance = useCallback(() => {
    const today = new Date().toISOString().split("T")[0]
    return attendanceLogs
      .filter(log => log.timestamp.startsWith(today))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [attendanceLogs])

  // Helper: Get attendance by date
  const getAttendanceByDate = useCallback((date: string) => {
    return attendanceLogs
      .filter(log => log.timestamp.startsWith(date))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [attendanceLogs])

  // Helper: Get stock logs by date
  const getStockLogsByDate = useCallback((date: string) => {
    return stockLogs
      .filter(log => log.timestamp.startsWith(date))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [stockLogs])

  const value: StoreContextType = {
    inventory,
    employees,
    stockLogs,
    attendanceLogs,
    users,
    menuItems,
    shiftAssignments,
    overtimeRequests,
    updateInventory,
    addInventoryItem,
    addStockLog,
    addAttendanceLog,
    getOnShiftEmployees,
    addEmployee,
    updateEmployee,
    toggleEmployeeStatus,
    assignNFC,
    findEmployeeByNFC,
    addUser,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    addShiftAssignment,
    updateShiftAssignment,
    deleteShiftAssignment,
    getShiftsByDate,
    getShiftsByEmployee,
    getEmployeeShiftForDate,
    hasShiftOnDate,
    addOvertimeRequest,
    approveOvertimeRequest,
    rejectOvertimeRequest,
    getPendingOvertimeRequests,
    getStockHealth,
    getDaysRemaining,
    getOverallStockHealth,
    getLowStockItems,
    getOperationalCapacity,
    getPurchaseRecommendations,
    getTodayAttendance,
    getAttendanceByDate,
    getStockLogsByDate
  }

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider")
  }
  return context
}
