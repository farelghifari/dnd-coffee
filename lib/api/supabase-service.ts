import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  inventory as mockInventory,
  employees as mockEmployees,
  stockLogs as mockStockLogs,
  attendanceLogs as mockAttendanceLogs,
  menuItems as mockMenuItems,
  shiftAssignments as mockShiftAssignments,
  overtimeRequests as mockOvertimeRequests,
  shiftConfigs as mockShiftConfigs
} from '@/lib/data'
import { getLocalYYYYMMDD } from '@/lib/utils'

// Storage keys for localStorage fallback
const STORAGE_KEYS = {
  inventory: "dnd_inventory",
  employees: "dnd_employees",
  stockLogs: "dnd_stock_logs",
  attendanceLogs: "dnd_attendance_logs",
  menuItems: "dnd_menu_items",
  shiftAssignments: "dnd_shift_assignments",
  overtimeRequests: "dnd_overtime_requests",
  shiftConfigs: "dnd_shift_configs",
  systemLogs: "dnd_system_logs"
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

// Generate unique IDs
function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// ========== UNIT CONVERSION ==========
// kg → gram (x1000), liter → ml (x1000)
// Base units: gram, ml, pcs

export type DisplayUnit = 'kg' | 'gram' | 'liter' | 'ml' | 'pcs'
export type BaseUnit = 'gram' | 'ml' | 'pcs'

export const UNIT_CONVERSIONS: Record<DisplayUnit, { baseUnit: BaseUnit; multiplier: number }> = {
  kg: { baseUnit: 'gram', multiplier: 1000 },
  gram: { baseUnit: 'gram', multiplier: 1 },
  liter: { baseUnit: 'ml', multiplier: 1000 },
  ml: { baseUnit: 'ml', multiplier: 1 },
  pcs: { baseUnit: 'pcs', multiplier: 1 }
}

// Convert display unit to base unit
export function toBaseUnit(value: number, unit: DisplayUnit): number {
  const conversion = UNIT_CONVERSIONS[unit]
  if (!conversion) return value
  return value * conversion.multiplier
}

// Convert base unit to display unit
export function fromBaseUnit(value: number, unit: DisplayUnit): number {
  const conversion = UNIT_CONVERSIONS[unit]
  if (!conversion) return value
  return value / conversion.multiplier
}

// Get base unit name from display unit
export function getBaseUnit(unit: DisplayUnit): BaseUnit {
  return UNIT_CONVERSIONS[unit]?.baseUnit || 'pcs'
}

// Get allowed units based on inventory item's base unit
// kg/gram -> allow: gram, kg
// liter/ml -> allow: ml, liter
// pcs -> allow: pcs only
export function getAllowedUnitsForItem(inventoryUnit: string): DisplayUnit[] {
  const normalizedUnit = inventoryUnit.toLowerCase()
  
  // Weight or Volume units - allow both for flexibility (e.g., syrup in kg or ml)
  if (normalizedUnit === 'kg' || normalizedUnit === 'gram' || normalizedUnit === 'g' || 
      normalizedUnit === 'liter' || normalizedUnit === 'ml' || normalizedUnit === 'l') {
    return ['gram', 'kg', 'ml', 'liter']
  }
  
  // Piece units - only pcs allowed
  return ['pcs']
}

// Get default display unit based on inventory item's stored unit
export function getDefaultDisplayUnit(inventoryUnit: string): DisplayUnit {
  const normalizedUnit = inventoryUnit.toLowerCase()
  
  if (normalizedUnit === 'kg') return 'kg'
  if (normalizedUnit === 'gram' || normalizedUnit === 'g') return 'gram'
  if (normalizedUnit === 'liter' || normalizedUnit === 'l') return 'liter'
  if (normalizedUnit === 'ml') return 'ml'
  
  return 'pcs'
}

// ========== TYPES MATCHING ACTUAL DB SCHEMA ==========

// DB Schema: employees(id, name, email, password, role, position, employment_type, nfc_uid, status, super_admin_expires_at)
export interface Employee {
  id: string
  name: string
  email: string
  password?: string
  role: "employee" | "admin" | "super_admin"
  position?: "barista" | "employee"
  employment_type: "full-time" | "part-time"
  nfc_uid: string | null
  status: "active" | "inactive"
  super_admin_expires_at?: string | null // Timestamp for temporary super_admin expiration
  // For local/fallback compatibility
  nickname?: string
  avatar?: string
  created_at?: string
}

// DB Schema: inventory_items(id, name, category, unit, stock)
export interface InventoryItem {
  id: string
  name: string
  category: "beans" | "milk" | "syrup" | "cups" | "food"
  unit: string
  stock: number
  // For local/fallback compatibility
  current_stock?: number
  min_stock?: number
  max_stock?: number
  daily_usage?: number
  last_updated?: string
  unit_cost?: number
}

// DB Schema: inventory_transactions(id, item_id, employee_id, type, quantity)
export interface InventoryTransaction {
  id: string
  item_id: string
  employee_id: string | null
  type: "in" | "out" | "waste" | "opname"
  quantity: number
}

// DB Schema: monthly_opex(id, month, category, amount, notes, attachment_url)
export interface MonthlyOpex {
  id: string
  month: string // YYYY-MM
  category: string
  amount: number
  notes?: string
  attachment_url?: string
  created_at: string
}

export interface InventoryOpname {
  id: string
  item_id: string
  theoretical_stock: number
  actual_stock: number
  difference: number
  reason?: string
  actor_name: string
  created_at: string
}

export interface StockLog {
  id: string
  item_id: string
  item_name: string
  type: "in" | "out" | "waste" | "opname"
  amount: number
  employee_id?: string | null
  employee_name?: string
  timestamp: string
  notes?: string
}

// DB Schema: attendance_logs(id, employee_id, date, time, action, status)
export interface AttendanceLog {
  id: string
  employee_id: string
  date: string
  time: string
  timestamp: string
  action: "clock-in" | "clock-out"
  status: string
  // For local/fallback compatibility
  employee_name?: string
  type?: "clock-in" | "clock-out"
}

// DB Schema: menu_items(id, name, type, price, status)
export interface MenuItem {
  id: string
  name: string
  type: "coffee" | "non-coffee" | "food"
  price: number
  packaging_cost?: number
  status: "active" | "inactive"
  // For local/fallback compatibility
  category?: "coffee" | "non-coffee" | "food"
  recipe?: { ingredients: MenuRecipeIngredient[] }
}

// DB Schema: shift_configs(id, name, start_time, end_time, day_type)
export interface ShiftConfig {
  id: string
  name: string
  start_time: string
  end_time: string
  day_type?: "weekday" | "weekend" // weekday = Mon-Fri, weekend = Sat-Sun
}

// DB Schema: shifts(id, employee_id, date, start_time, end_time, shift_config_id)
export interface ShiftAssignment {
  id: string
  employee_id: string
  date: string
  start_time: string
  end_time: string
  shift_config_id?: string // Reference to predefined shift
  // For local/fallback compatibility
  employee_name?: string
  day_of_week?: number
  shift_name?: string
}

export interface OvertimeRequest {
  id: string
  employee_id: string
  employee_name: string
  attendance_log_id: string
  request_date: string
  clock_in_time: string
  status: "pending" | "approved" | "rejected"
  reviewed_by?: string
  reviewed_at?: string
  notes?: string
  // Enhanced overtime fields
  scheduled_end_time?: string
  actual_clock_out_time?: string
  overtime_minutes?: number
}

// System Activity Log - tracks all system changes
export interface SystemLog {
  id: string
  action: "inventory_change" | "employee_update" | "role_change" | "settings_change" | "shift_change" | "overtime_action"
  actor: string // Who made the change (email or name)
  target: string // What was changed (item name, employee name, etc.)
  details: string // Description of the change
  timestamp: string
}

// DB Schema: payrolls
export interface PayrollRecord {
  id?: string
  employee_id: string
  start_date: string
  end_date: string
  total_hours: number
  ot_hours: number
  salary_hourly: number
  adjustment: number
  total_payroll: number
  status: "draft" | "settled"
  created_at?: string
  updated_at?: string
  // Enhanced frontend fields
  employee_name?: string
  employment_type?: "full-time" | "part-time"
}

// ========== EMPLOYEES ==========

export async function getEmployees(): Promise<Employee[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name', { ascending: true })
    
    console.log("DATA (getEmployees):", data)
    console.log("ERROR (getEmployees):", error)
    
    if (error) {
      return []
    }
    return data || []
  }
  
  return getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
}

export async function getActiveEmployees(): Promise<Employee[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true })
    
    console.log("DATA (getActiveEmployees):", data)
    console.log("ERROR (getActiveEmployees):", error)
    
    if (error) {
      return []
    }
    return data || []
  }
  
  const employees = getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
  return employees.filter(e => e.status === 'active').sort((a, b) => a.name.localeCompare(b.name))
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single()
    
    console.log("DATA (getEmployeeById):", data)
    console.log("ERROR (getEmployeeById):", error)
    
    if (error) {
      return null
    }
    return data
  }
  
  const employees = getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
  return employees.find(e => e.id === id) || null
}

export async function getEmployeeByEmail(email: string): Promise<Employee | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('email', email)
      .single()
    
    console.log("DATA (getEmployeeByEmail):", data)
    console.log("ERROR (getEmployeeByEmail):", error)
    
    if (error) {
      return null
    }
    return data
  }
  
  const employees = getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
  return employees.find(e => e.email === email) || null
}

// NFC LOGIN - Use exact query: select * from employees where nfc_uid = scanned_uid and status = 'active'
export async function getEmployeeByNFC(nfcUid: string): Promise<Employee | null> {
  // Clean the UID: trim whitespace, remove line breaks
  const cleanUID = nfcUid.trim().replace(/[\r\n]/g, '')
  
  console.log("RAW UID:", nfcUid)
  console.log("CLEAN UID:", cleanUID)
  
  if (isSupabaseConfigured()) {
    // Try exact match first
    let { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('nfc_uid', cleanUID)
      .eq('status', 'active')
      .single()
    
    console.log("DATA (getEmployeeByNFC exact):", data)
    console.log("ERROR (getEmployeeByNFC exact):", error)
    
    // If no exact match, try case-insensitive
    if (error || !data) {
      const result = await supabase
        .from('employees')
        .select('*')
        .ilike('nfc_uid', cleanUID)
        .eq('status', 'active')
        .single()
      
      data = result.data
      error = result.error
      
      console.log("DATA (getEmployeeByNFC ilike):", data)
      console.log("ERROR (getEmployeeByNFC ilike):", error)
    }
    
    if (error || !data) {
      return null
    }
    return data
  }
  
  // Fallback - use case-insensitive match
  const employees = getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
  return employees.find(e => 
    e.nfc_uid?.toLowerCase() === cleanUID.toLowerCase() && e.status === 'active'
  ) || null
}

export async function addEmployee(employee: Omit<Employee, 'id'>): Promise<Employee | null> {
  if (isSupabaseConfigured()) {
    // Only insert fields that exist in the DB schema
    const dbEmployee = {
      name: employee.name,
      email: employee.email,
      password: employee.password,
      role: employee.role || 'employee',
      position: employee.position || 'employee',
      employment_type: employee.employment_type,
      nfc_uid: employee.nfc_uid,
      status: employee.status
    }
    
    const { data, error } = await supabase
      .from('employees')
      .insert([dbEmployee])
      .select()
      .single()
    
    console.log("DATA (addEmployee):", data)
    console.log("ERROR (addEmployee):", error)
    
    if (error) {
      return null
    }
    return data
  }
  
  const employees = getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
  const newEmployee: Employee = {
    ...employee,
    id: generateId('emp')
  }
  employees.push(newEmployee)
  setStoredData(STORAGE_KEYS.employees, employees)
  return newEmployee
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
  // MANDATORY DEBUG - Required for troubleshooting
  console.log("UPDATE ID:", id)
  console.log("UPDATES:", updates)
  
  if (isSupabaseConfigured()) {
    // Build update payload with only defined fields
    const dbUpdates: Record<string, unknown> = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.nickname !== undefined) dbUpdates.nickname = updates.nickname
    if (updates.email !== undefined) dbUpdates.email = updates.email
    if (updates.password !== undefined) dbUpdates.password = updates.password
    if (updates.role !== undefined) dbUpdates.role = updates.role
    if (updates.position !== undefined) dbUpdates.position = updates.position
    if (updates.employment_type !== undefined) dbUpdates.employment_type = updates.employment_type
    if (updates.nfc_uid !== undefined) dbUpdates.nfc_uid = updates.nfc_uid
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.super_admin_expires_at !== undefined) dbUpdates.super_admin_expires_at = updates.super_admin_expires_at
    
    console.log("NEW ROLE:", updates.role)
    console.log("EXPIRES:", updates.super_admin_expires_at)
    
    // MANDATORY UPDATE PATTERN - Use .select() without .single() to avoid errors on empty results
    const { data, error } = await supabase
      .from('employees')
      .update(dbUpdates)
      .eq('id', id)
      .select()
    
    console.log("ERROR:", error)
    console.log("RESULT:", data)
    
    if (error) {
      console.log("Supabase error details:", JSON.stringify(error, null, 2))
      return null
    }
    
    // VERIFY SAVE - Check that data was actually updated
    if (!data || data.length === 0) {
      console.log("ERROR: No rows updated - employee ID may not exist")
      return null
    }
    
    // Verify role was actually saved if role was being updated
    if (updates.role && data[0].role !== updates.role) {
      console.log("ERROR: Role not saved correctly! Expected:", updates.role, "Got:", data[0].role)
      return null
    }
    
    console.log("SUCCESS: Employee updated:", data[0])
    return data[0]
  }
  
  const employees = getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
  const index = employees.findIndex(e => e.id === id)
  if (index === -1) return null
  employees[index] = { ...employees[index], ...updates }
  setStoredData(STORAGE_KEYS.employees, employees)
  return employees[index]
}

export async function toggleEmployeeStatus(id: string, currentStatus: string) {
  const newStatus = currentStatus === "active" ? "inactive" : "active"
  return updateEmployee(id, { status: newStatus as "active" | "inactive" })
}

export async function assignNFC(id: string, nfcUid: string) {
  return updateEmployee(id, { nfc_uid: nfcUid })
}

// Promote to super_admin with database-calculated expiration
// Uses PostgreSQL now() + interval to avoid timezone issues
// IMPORTANT: Do NOT calculate expiration in frontend - let database handle it
export async function promoteSuperAdmin(id: string, durationMinutes: number): Promise<Employee | null> {
  // MANDATORY DEBUG - Log the input
  console.log("PROMOTE SUPER ADMIN - ID:", id)
  console.log("DURATION MINUTES:", durationMinutes)
  
  if (isSupabaseConfigured()) {
    // Use raw SQL via rpc to let PostgreSQL calculate the expiration time
    // This avoids timezone issues by using database's now() function
    const { data: rpcData, error: rpcError } = await supabase.rpc('promote_to_super_admin', {
      employee_id: id,
      duration_minutes: durationMinutes
    })
    
    console.log("DATA (promoteSuperAdmin RPC):", rpcData)
    console.log("ERROR (promoteSuperAdmin RPC):", rpcError)
    
    // If RPC exists and succeeded, return the result
    if (!rpcError && rpcData) {
      // If RPC returns the employee directly
      if (rpcData.id) {
        return rpcData
      }
      // If RPC returns success, fetch the updated employee
      const { data: fetchedData } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single()
      
      return fetchedData
    }
    
    // If RPC doesn't exist (error code 42883) or failed, use raw SQL approach
    // Execute raw SQL that uses PostgreSQL's now() + interval
    if (rpcError) {
      console.log("RPC failed or doesn't exist, using raw SQL approach")
      
      // Use Supabase's raw SQL execution via rpc with a generic SQL executor
      // OR fall back to using a calculated timestamp from server if no SQL RPC available
      // Since we can't execute raw SQL directly, we'll use a workaround:
      // Fetch the server time first, then calculate expiration based on that
      
      // Try to get server time using a simple query
      const { data: serverTimeData, error: serverTimeError } = await supabase
        .rpc('get_server_time')
      
      console.log("SERVER TIME DATA:", serverTimeData)
      console.log("SERVER TIME ERROR:", serverTimeError)
      
      let expiresAt: string
      
      if (!serverTimeError && serverTimeData) {
        // Use server time to calculate expiration
        const serverTime = new Date(serverTimeData)
        expiresAt = new Date(serverTime.getTime() + durationMinutes * 60000).toISOString()
        console.log("USING SERVER TIME - EXPIRES AT:", expiresAt)
      } else {
        // Last resort: Use raw SQL via the update itself
        // We'll construct the interval string and use it in a special way
        // Since standard Supabase client doesn't support raw SQL in update,
        // we need to use a timestamp that the database will interpret
        
        // Calculate using UTC to minimize timezone issues
        const nowUtc = new Date()
        expiresAt = new Date(nowUtc.getTime() + durationMinutes * 60000).toISOString()
        console.log("FALLBACK - UTC NOW:", nowUtc.toISOString())
        console.log("FALLBACK - EXPIRES AT:", expiresAt)
      }
      
      const { data: sqlData, error: sqlError } = await supabase
        .from('employees')
        .update({
          role: 'super_admin',
          super_admin_expires_at: expiresAt
        })
        .eq('id', id)
        .select()
      
      console.log("DATA (promoteSuperAdmin SQL):", sqlData)
      console.log("ERROR (promoteSuperAdmin SQL):", sqlError)
      
      if (sqlError || !sqlData || sqlData.length === 0) {
        return null
      }
      
      console.log("SUCCESS - SAVED EXPIRES AT:", sqlData[0].super_admin_expires_at)
      return sqlData[0]
    }
    
    return null
  }
  
  // Fallback for localStorage - use UTC time
  const employees = getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
  const index = employees.findIndex(e => e.id === id)
  if (index === -1) return null
  
  const nowUtc = new Date()
  employees[index] = {
    ...employees[index],
    role: 'super_admin',
    super_admin_expires_at: new Date(nowUtc.getTime() + durationMinutes * 60000).toISOString()
  }
  setStoredData(STORAGE_KEYS.employees, employees)
  return employees[index]
}

export async function getAdmins(): Promise<Employee[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('role', 'admin')
      .order('name', { ascending: true })
    
    console.log("DATA (getAdmins):", data)
    console.log("ERROR (getAdmins):", error)
    
    if (error) {
      return []
    }
    return data || []
  }
  
  const employees = getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
  return employees.filter(e => e.role === 'admin')
}

export async function deleteEmployee(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id)
    
    console.log("ERROR (deleteEmployee):", error)
    
    if (error) {
      return false
    }
    return true
  }
  
  const employees = getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
  const filtered = employees.filter(e => e.id !== id)
  setStoredData(STORAGE_KEYS.employees, filtered)
  return true
}

// ========== AUTHENTICATION ==========

export async function authenticateUser(email: string, password: string): Promise<Employee | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single()
    
    console.log("DATA (authenticateUser):", data)
    console.log("ERROR (authenticateUser):", error)
    
    if (error || !data) {
      return null
    }
    return data
  }
  
  const employees = getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
  return employees.find(e => e.email === email && e.password === password) || null
}

export function getCurrentUser() {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem("dnd_user")
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

export function getOpsSession() {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem("dnd_ops_session")
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

// ========== INVENTORY ==========
// DB Schema: inventory_items(id, name, category, unit, stock)

export async function getInventory(): Promise<InventoryItem[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name', { ascending: true })
    
    console.log("DATA (getInventory):", data)
    console.log("ERROR (getInventory):", error)
    
    if (error) {
      return []
    }
    // Map 'stock' to 'current_stock' for compatibility
    return (data || []).map(item => ({
      ...item,
      current_stock: item.stock
    }))
  }
  
  const stored = getStoredData(STORAGE_KEYS.inventory, mockInventory)
  return stored.map(item => ({
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    stock: 'currentStock' in item ? (item as { currentStock: number }).currentStock : (item as InventoryItem).stock || 0,
    current_stock: 'currentStock' in item ? (item as { currentStock: number }).currentStock : (item as InventoryItem).stock || 0,
    min_stock: 'minStock' in item ? (item as { minStock: number }).minStock : 0,
    max_stock: 'maxStock' in item ? (item as { maxStock: number }).maxStock : 100,
    daily_usage: 'dailyUsage' in item ? (item as { dailyUsage: number }).dailyUsage : 1,
    last_updated: 'lastUpdated' in item ? (item as { lastUpdated: string }).lastUpdated : new Date().toISOString(),
    unit_cost: 'unitCost' in item ? (item as { unitCost: number }).unitCost : 0
  })) as InventoryItem[]
}

export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single()
    
    console.log("DATA (getInventoryItem):", data)
    console.log("ERROR (getInventoryItem):", error)
    
    if (error) {
      return null
    }
    return data ? { ...data, current_stock: data.stock } : null
  }
  
  const inventory = await getInventory()
  return inventory.find(i => i.id === id) || null
}

export async function addInventoryItem(item: { 
  name: string; 
  category: string; 
  unit: string; 
  stock: number;
  min_stock?: number;
  max_stock?: number;
  daily_usage?: number;
  unit_cost?: number;
}): Promise<InventoryItem | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert([{
        name: item.name,
        category: item.category,
        unit: item.unit,
        stock: item.stock,
        min_stock: item.min_stock || 0,
        max_stock: item.max_stock || 100,
        daily_usage: item.daily_usage || 0,
        unit_cost: item.unit_cost || 0
      }])
      .select()
      .single()
    
    console.log("DATA (addInventoryItem):", data)
    console.log("ERROR (addInventoryItem):", error)
    
    if (error) {
      return null
    }
    return data ? { ...data, current_stock: data.stock } : null
  }
  
  const inventory = await getInventory()
  const newItem: InventoryItem = {
    ...item,
    id: generateId(item.category),
    current_stock: item.stock
  } as InventoryItem
  inventory.push(newItem)
  setStoredData(STORAGE_KEYS.inventory, inventory)
  return newItem
}

export async function updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem | null> {
  if (isSupabaseConfigured()) {
    // Only update fields that exist in DB schema
    const dbUpdates: Record<string, unknown> = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.category !== undefined) dbUpdates.category = updates.category
    if (updates.unit !== undefined) dbUpdates.unit = updates.unit
    if (updates.stock !== undefined) dbUpdates.stock = updates.stock
    if (updates.current_stock !== undefined) dbUpdates.stock = updates.current_stock
    if (updates.min_stock !== undefined) dbUpdates.min_stock = updates.min_stock
    if (updates.max_stock !== undefined) dbUpdates.max_stock = updates.max_stock
    if (updates.daily_usage !== undefined) dbUpdates.daily_usage = updates.daily_usage
    if (updates.unit_cost !== undefined) dbUpdates.unit_cost = updates.unit_cost
    
    const { data, error } = await supabase
      .from('inventory_items')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single()
    
    console.log("DATA (updateInventoryItem):", data)
    console.log("ERROR (updateInventoryItem):", error)
    
    if (error) {
      return null
    }
    return data ? { ...data, current_stock: data.stock } : null
  }
  
  const inventory = await getInventory()
  const index = inventory.findIndex(i => i.id === id)
  if (index === -1) return null
  inventory[index] = { ...inventory[index], ...updates }
  setStoredData(STORAGE_KEYS.inventory, inventory)
  return inventory[index]
}

export async function deleteInventoryItem(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id)
    
    console.log("ERROR (deleteInventoryItem):", error)
    
    if (error) {
      return false
    }
    return true
  }
  
  const inventory = await getInventory()
  const filtered = inventory.filter(i => i.id !== id)
  setStoredData(STORAGE_KEYS.inventory, filtered)
  return true
}

// Update inventory stock and create transaction
export async function updateInventoryStock(itemId: string, quantity: number, type: "in" | "out" | "waste" | "opname", employeeId: string | null, actorName: string = 'System') {
  const item = await getInventoryItem(itemId)
  if (!item) return null
  
  let newStock = item.stock || item.current_stock || 0
  switch (type) {
    case "in":
      newStock += quantity
      break
    case "out":
    case "waste":
      newStock = Math.max(0, newStock - quantity)
      break
    case "opname":
      newStock = quantity
      break
  }
  
  let updatedItemResult: any = null

  if (isSupabaseConfigured()) {
    // Update inventory_items.stock
    const { data: updatedItem, error: updateError } = await supabase
      .from('inventory_items')
      .update({ stock: newStock })
      .eq('id', itemId)
      .select()
      .single()
    
    console.log("DATA (updateInventoryStock):", updatedItem)
    console.log("ERROR (updateInventoryStock):", updateError)
    
    if (updateError) {
      return null
    }
    
    updatedItemResult = updatedItem ? { ...updatedItem, current_stock: updatedItem.stock } : null
    
    // Insert into inventory_transactions
    const { data: transaction, error: transError } = await supabase
      .from('inventory_transactions')
      .insert([{
        item_id: itemId,
        employee_id: employeeId,
        type: type,
        quantity: quantity
      }])
      .select()
      .single()
    
    console.log("DATA (inventory_transaction insert):", transaction)
    console.log("ERROR (inventory_transaction insert):", transError)
  } else {
    updatedItemResult = await updateInventoryItem(itemId, { stock: newStock, current_stock: newStock })
  }

  // Log activity
  if (updatedItemResult && item) {
    const typeLabel = type === 'in' ? 'Stock In' : type === 'out' ? 'Stock Out' : type === 'waste' ? 'Waste' : 'Opname'
    const detail = `${typeLabel}: ${quantity} ${item.unit} for ${item.name}`
    await logActivity('inventory_change', actorName, itemId, detail)
  }
  
  return updatedItemResult
}


// ========== UPSERT INVENTORY (FLOW 1 - ADD/EDIT ITEM) ==========
// INPUT: id (optional for insert), name, category, unit, stock
// Calls RPC: upsert_inventory() for both add and edit operations

export interface UpsertInventoryData {
  id?: string
  name: string
  category: string
  unit: string
  stock: number
  min_stock?: number
  max_stock?: number
  daily_usage?: number
  unit_cost?: number
}

export async function upsertInventory(data: UpsertInventoryData, actorName: string = 'System'): Promise<InventoryItem | null> {
  const isUpdate = !!data.id
  let resultItem: InventoryItem | null = null

  if (isSupabaseConfigured()) {
    // Call RPC: upsert_inventory
    const { data: result, error } = await supabase.rpc('upsert_inventory', {
      p_id: data.id || null,
      p_name: data.name,
      p_category: data.category,
      p_unit: data.unit,
      p_stock: data.stock,
      p_min_stock: data.min_stock || 0,
      p_max_stock: data.max_stock || 0,
      p_daily_usage: data.daily_usage || 0,
      p_unit_cost: data.unit_cost || 0
    })
    
    if (error) {
      console.log("ERROR (upsertInventory RPC):", error)
      // Fallback to direct insert/update if RPC doesn't exist
      if (data.id) {
        resultItem = await updateInventoryItem(data.id, {
          name: data.name,
          category: data.category as InventoryItem['category'],
          unit: data.unit,
          stock: data.stock,
          current_stock: data.stock,
          min_stock: data.min_stock,
          max_stock: data.max_stock,
          daily_usage: data.daily_usage,
          unit_cost: data.unit_cost
        })
      } else {
        resultItem = await addInventoryItem({
          name: data.name,
          category: data.category,
          unit: data.unit,
          stock: data.stock
        })
      }
    } else {
      // Return the upserted item
      if (result) {
        resultItem = { ...result, current_stock: result.stock }
      } else if (data.id) {
        resultItem = await getInventoryItem(data.id)
      } else {
        // For new items, fetch by name (best effort)
        const allItems = await getInventory()
        resultItem = allItems.find(i => i.name === data.name) || null
      }
    }
  } else {
    // Fallback for localStorage
    if (data.id) {
      resultItem = await updateInventoryItem(data.id, {
        name: data.name,
        category: data.category as InventoryItem['category'],
        unit: data.unit,
        stock: data.stock,
        current_stock: data.stock
      })
    } else {
      resultItem = await addInventoryItem({
        name: data.name,
        category: data.category,
        unit: data.unit,
        stock: data.stock
      })
    }
  }

  // Log activity
  if (resultItem) {
    const detail = isUpdate 
      ? `Updated inventory item details: ${resultItem.name}`
      : `Added new inventory item: ${resultItem.name} (${resultItem.stock} ${resultItem.unit})`
    
    await logActivity('inventory_change', actorName, resultItem.id, detail)
  }

  return resultItem
}


// ========== ADD STOCK (FLOW 2) ==========
// INPUT: item_id, quantity, unit_cost
// STEP 5: Call RPC: add_stock(item_id, quantity, unit_cost)

export async function addStock(itemId: string, quantity: number, unitCost: number): Promise<boolean> {
  if (isSupabaseConfigured()) {
    // Call RPC: add_stock
    const { error } = await supabase.rpc('add_stock', {
      p_item_id: itemId,
      p_quantity: quantity,
      p_unit_cost: unitCost
    })
    
    if (error) {
      console.log("ERROR (addStock RPC):", error)
      return false
    }
    
    return true
  }
  
  // Fallback for localStorage
  const inventory = await getInventory()
  const index = inventory.findIndex(i => i.id === itemId)
  if (index === -1) return false
  
  const newStock = (inventory[index].stock || inventory[index].current_stock || 0) + quantity
  inventory[index] = { ...inventory[index], stock: newStock, current_stock: newStock }
  setStoredData(STORAGE_KEYS.inventory, inventory)
  return true
}

// ========== STOCK OUT (FLOW 2) ==========
// INPUT: item_id, quantity
// STEP 5: Call RPC: stock_out(item_id, quantity)

export async function stockOut(itemId: string, quantity: number): Promise<boolean> {
  if (isSupabaseConfigured()) {
    // Call RPC: stock_out
    const { error } = await supabase.rpc('stock_out', {
      p_item_id: itemId,
      p_quantity: quantity
    })
    
    if (error) {
      console.log("ERROR (stockOut RPC):", error)
      return false
    }
    
    return true
  }
  
  // Fallback for localStorage
  const inventory = await getInventory()
  const index = inventory.findIndex(i => i.id === itemId)
  if (index === -1) return false
  
  const newStock = (inventory[index].stock || inventory[index].current_stock || 0) - quantity
  inventory[index] = { ...inventory[index], stock: newStock, current_stock: newStock }
  setStoredData(STORAGE_KEYS.inventory, inventory)
  return true
}

// ========== STOCK OUT MANUAL ==========
// For manual stock removal (waste, damage, etc)
// INPUT: item_id, quantity, reason (optional)
// Calls RPC: stock_out_manual(item_id, quantity, reason)

export async function stockOutManual(itemId: string, quantity: number, reason?: string, actorName: string = 'System'): Promise<boolean> {
  // Get item name for logging
  const item = await getInventoryItem(itemId)
  
  if (isSupabaseConfigured()) {
    // Call RPC: stock_out_manual
    const { error } = await supabase.rpc('stock_out_manual', {
      p_item_id: itemId,
      p_quantity: quantity,
      p_reason: reason || 'manual'
    })
    
    if (error) {
      console.log("ERROR (stockOutManual RPC):", error)
      // Fallback to regular stock_out if manual doesn't exist
      const success = await stockOut(itemId, quantity)
      if (success && item) {
        await logActivity(
          'inventory_change', 
          actorName, 
          itemId, 
          `Stock Out (Manual): ${quantity} ${item.unit} removed from ${item.name}. Reason: ${reason || 'manual'}`
        )
      }
      return success
    }
    
    if (item) {
      await logActivity(
        'inventory_change', 
        actorName, 
        itemId, 
        `Stock Out (Manual): ${quantity} ${item.unit} removed from ${item.name}. Reason: ${reason || 'manual'}`
      )
    }
    
    return true
  }
  
  // Fallback to stockOut for localStorage
  const success = await stockOut(itemId, quantity)
  if (success && item) {
    await logActivity(
      'inventory_change', 
      actorName, 
      itemId, 
      `Stock Out (Manual): ${quantity} ${item.unit} removed from ${item.name}. Reason: ${reason || 'manual'}`
    )
  }
  return success
}


// ========== SELL MENU (FLOW 3 - AUTO INVENTORY DEDUCT) ==========
// INPUT: menu_id, quantity
// STEP 5: Call RPC: sell_menu(menu_id, quantity)

export async function sellMenu(menuId: string, quantity: number): Promise<boolean> {
  if (isSupabaseConfigured()) {
    // Call RPC: sell_menu
    const { error } = await supabase.rpc('sell_menu', {
      p_menu_id: menuId,
      p_quantity: quantity
    })
    
    if (error) {
      console.log("ERROR (sellMenu RPC):", error)
      return false
    }
    
    return true
  }
  
  // Fallback - no local implementation
  return false
}

// ========== MENU RECIPES ==========
// Save menu ingredients to menu_recipes table

export interface MenuRecipeIngredient {
  inventory_item_id: string
  quantity: number
  unit?: DisplayUnit
}

// FIX RECIPE NOT SHOWING: Properly save recipes with verification
// STEP 1: DELETE existing menu_recipes WHERE menu_item_id
// STEP 2: INSERT ALL ingredients into menu_recipes
// STEP 3: VERIFY: SELECT * FROM menu_recipes WHERE menu_item_id
// STEP 4: IF EMPTY → retry insert
export async function saveMenuRecipes(menuItemId: string, ingredients: MenuRecipeIngredient[]): Promise<boolean> {
  if (isSupabaseConfigured()) {
    // STEP 1: Delete existing recipes for this menu item
    const { error: deleteError } = await supabase
      .from('menu_recipes')
      .delete()
      .eq('menu_item_id', menuItemId)
    
    if (deleteError) {
      console.log("ERROR (saveMenuRecipes delete):", deleteError)
    }
    
    // STEP 2: Insert new recipes
    if (ingredients.length > 0) {
      const recipesToInsert = ingredients.map(ing => ({
        menu_item_id: menuItemId,
        inventory_item_id: ing.inventory_item_id,
        quantity: ing.quantity,
        unit: ing.unit || 'pcs'
      }))
      
      const { error: insertError } = await supabase
        .from('menu_recipes')
        .insert(recipesToInsert)
      
      if (insertError) {
        console.log("ERROR (saveMenuRecipes insert):", insertError)
        return false
      }
      
      // STEP 3: VERIFY - SELECT * FROM menu_recipes WHERE menu_item_id
      const { data: verifyData, error: verifyError } = await supabase
        .from('menu_recipes')
        .select('*')
        .eq('menu_item_id', menuItemId)
      
      console.log("VERIFY (saveMenuRecipes):", verifyData)
      
      // STEP 4: IF EMPTY → retry insert once
      if (verifyError || !verifyData || verifyData.length === 0) {
        console.log("VERIFY FAILED - retrying insert")
        const { error: retryError } = await supabase
          .from('menu_recipes')
          .insert(recipesToInsert)
        
        if (retryError) {
          console.log("ERROR (saveMenuRecipes retry):", retryError)
          return false
        }
      }
    }
    
    return true
  }
  
  // Fallback - no local implementation
  return false
}

export async function getMenuRecipes(menuItemId: string): Promise<MenuRecipeIngredient[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('menu_recipes')
      .select('inventory_item_id, quantity, unit')
      .eq('menu_item_id', menuItemId)
    
    if (error) {
      console.log("ERROR (getMenuRecipes):", error)
      return []
    }
    
    // Map data from database to UI format
    return (data || []).map((row: any) => ({
      inventory_item_id: row.inventory_item_id,
      // Convert quantity back from base unit to display unit
      quantity: fromBaseUnit(row.quantity, (row.unit || 'pcs') as DisplayUnit),
      unit: (row.unit || 'pcs') as DisplayUnit
    }))
  }
  
  return []
}

// ========== SALES LOGS (STEP 3 - REPORT INTEGRATION) ==========
// Fetch from sales_logs: menu name, total sold, revenue

export interface SalesLog {
  id: string
  menu_id: string
  menu_name?: string
  quantity: number
  total_price: number
  created_at: string
}

export interface SalesReport {
  menu_id: string
  menu_name: string
  total_sold: number
  revenue: number
}

export async function getSalesLogs(): Promise<SalesLog[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('sales_logs')
      .select(`
        id,
        menu_id,
        quantity,
        total_price,
        created_at,
        menu_items(name)
      `)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.log("ERROR (getSalesLogs):", error)
      return []
    }
    
    // Map menu_items.name to menu_name
    return (data || []).map(log => ({
      id: log.id,
      menu_id: log.menu_id,
      menu_name: (log.menu_items as unknown as { name: string })?.name || 'Unknown',
      quantity: log.quantity,
      total_price: log.total_price,
      created_at: log.created_at
    }))
  }
  
  return []
}

export async function getSalesReport(): Promise<SalesReport[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('sales_logs')
      .select(`
        menu_id,
        quantity,
        total_price,
        menu_items(name)
      `)
    
    if (error) {
      console.log("ERROR (getSalesReport):", error)
      return []
    }
    
    // Aggregate by menu_id
    const reportMap = new Map<string, SalesReport>()
    
    for (const log of data || []) {
      const menuId = log.menu_id
      const menuName = (log.menu_items as unknown as { name: string })?.name || 'Unknown'
      
      if (reportMap.has(menuId)) {
        const existing = reportMap.get(menuId)!
        existing.total_sold += log.quantity
        existing.revenue += log.total_price
      } else {
        reportMap.set(menuId, {
          menu_id: menuId,
          menu_name: menuName,
          total_sold: log.quantity,
          revenue: log.total_price
        })
      }
    }
    
    return Array.from(reportMap.values()).sort((a, b) => b.revenue - a.revenue)
  }
  
  return []
}

// ========== REALTIME SUBSCRIPTIONS (STEP 4) ==========
// Subscribe to: inventory_items, inventory_transactions, sales_logs
// On change: update only affected row, NEVER reload page

export interface RealtimePayload {
  new?: Record<string, unknown>
  old?: Record<string, unknown>
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE'
}

export function subscribeToInventoryTransactions(callback: (payload?: RealtimePayload) => void) {
  if (!isSupabaseConfigured()) return () => {}
  
  const channel = supabase
    .channel('inventory_transactions_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inventory_transactions' },
      (payload) => {
        callback({
          new: payload.new as Record<string, unknown>,
          old: payload.old as Record<string, unknown>,
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
        })
      }
    )
    .subscribe()
  
  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToSalesLogs(callback: (payload?: RealtimePayload) => void) {
  if (!isSupabaseConfigured()) return () => {}
  
  const channel = supabase
    .channel('sales_logs_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sales_logs' },
      (payload) => {
        callback({
          new: payload.new as Record<string, unknown>,
          old: payload.old as Record<string, unknown>,
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
        })
      }
    )
    .subscribe()
  
  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToMenuItems(callback: (payload?: RealtimePayload) => void) {
  if (!isSupabaseConfigured()) return () => {}
  
  const channel = supabase
    .channel('menu_items_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'menu_items' },
      (payload) => {
        callback({
          new: payload.new as Record<string, unknown>,
          old: payload.old as Record<string, unknown>,
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
        })
      }
    )
    .subscribe()
  
  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToInventoryItems(callback: (payload?: RealtimePayload) => void) {
  if (!isSupabaseConfigured()) return () => {}
  
  const channel = supabase
    .channel('inventory_items_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inventory_items' },
      (payload) => {
        callback({
          new: payload.new as Record<string, unknown>,
          old: payload.old as Record<string, unknown>,
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
        })
      }
    )
    .subscribe()
  
  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToAttendanceLogs(callback: (payload?: RealtimePayload) => void) {
  if (!isSupabaseConfigured()) return () => {}
  
  const channel = supabase
    .channel('attendance_logs_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attendance_logs' },
      (payload) => {
        callback({
          new: payload.new as Record<string, unknown>,
          old: payload.old as Record<string, unknown>,
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
        })
      }
    )
    .subscribe()
  
  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToSystemLogs(callback: (payload?: RealtimePayload) => void) {
  if (!isSupabaseConfigured()) return () => {}
  
  const channel = supabase
    .channel('system_logs_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'system_logs' },
      (payload) => {
        callback({
          new: payload.new as Record<string, unknown>,
          old: payload.old as Record<string, unknown>,
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
        })
      }
    )
    .subscribe()
  
  return () => {
    supabase.removeChannel(channel)
  }
}


// ========== STOCK LOGS (for local compatibility) ==========

export async function getStockLogs(): Promise<StockLog[]> {
  if (isSupabaseConfigured()) {
    // Get from inventory_transactions and join with inventory_items and employees
    const { data, error } = await supabase
      .from('inventory_transactions')
      .select(`
        id,
        item_id,
        type,
        quantity,
        employee_id,
        created_at,
        inventory_items(name),
        employees(name)
      `)
      .order('created_at', { ascending: false })
    
    console.log("DATA (getStockLogs):", data)
    console.log("ERROR (getStockLogs):", error)
    
    if (error) {
      console.error("Error fetching stock logs:", error)
      return []
    }
    
    // Map to StockLog format
    return (data || []).map(t => ({
      id: t.id,
      item_id: t.item_id,
      item_name: (t.inventory_items as any)?.name || 'Unknown Item',
      type: t.type,
      amount: t.quantity,
      employee_id: t.employee_id,
      employee_name: (t.employees as any)?.name || 'Unknown User',
      timestamp: t.created_at,
      notes: '' // notes aren't in transactions table yet, but field is required by interface
    }))
  }
  
  const stored = getStoredData(STORAGE_KEYS.stockLogs, mockStockLogs)
  return stored.map(log => ({
    id: log.id,
    item_id: 'item_id' in log ? log.item_id : (log as { itemId: string }).itemId,
    item_name: 'item_name' in log ? log.item_name : (log as { itemName: string }).itemName,
    type: log.type,
    amount: log.amount,
    employee_id: 'employee_id' in log ? log.employee_id : (log as { employeeId: string }).employeeId,
    employee_name: 'employee_name' in log ? log.employee_name : (log as { employeeName: string }).employeeName,
    timestamp: log.timestamp,
    notes: log.notes
  })) as StockLog[]
}


export async function getStockLogsByDate(date: string): Promise<StockLog[]> {
  const logs = await getStockLogs()
  const startOfDay = `${date}T00:00:00.000Z`
  const endOfDay = `${date}T23:59:59.999Z`
  return logs.filter(log => log.timestamp >= startOfDay && log.timestamp <= endOfDay)
}

export async function addStockLog(log: Omit<StockLog, 'id' | 'timestamp'>): Promise<StockLog | null> {
  // Use updateInventoryStock which handles both the stock update and transaction insert
  const result = await updateInventoryStock(
    log.item_id, 
    log.amount, 
    log.type, 
    log.employee_id || null, 
    log.employee_name || 'System'
  )

  
  if (result) {
    // For local storage, also add to stockLogs
    const logs = await getStockLogs()
    const newLog: StockLog = {
      ...log,
      id: generateId('log'),
      timestamp: new Date().toISOString()
    }
    logs.unshift(newLog)
    setStoredData(STORAGE_KEYS.stockLogs, logs)
    return newLog
  }
  
  return null
}

// ========== ATTENDANCE LOGS ==========
// DB Schema: attendance_logs(id, employee_id, date, time, action, status)

export async function getAttendanceLogs(): Promise<AttendanceLog[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .order('date', { ascending: false })
    
    console.log("DATA (getAttendanceLogs):", data)
    console.log("ERROR (getAttendanceLogs):", error)
    
    if (error) {
      console.error("Attendance Log Error:", error)
      return []
    }
    // Map to include type and timestamp for compatibility
    return (data || []).map(log => ({
      ...log,
      employee_name: log.employee_name || 'Unknown',
      type: log.action,
      timestamp: `${log.date}T${log.time}`
    }))
  }
  
  const stored = getStoredData(STORAGE_KEYS.attendanceLogs, mockAttendanceLogs)
  return stored.map(log => ({
    id: log.id,
    employee_id: 'employee_id' in log ? log.employee_id : (log as { employeeId: string }).employeeId,
    employee_name: 'employee_name' in log ? log.employee_name : (log as { employeeName: string }).employeeName,
    date: log.timestamp?.split('T')[0] || new Date().toISOString().split('T')[0],
    time: log.timestamp?.split('T')[1]?.substring(0, 8) || '00:00:00',
    action: log.type,
    status: 'present',
    type: log.type,
    timestamp: log.timestamp
  })) as AttendanceLog[]
}

export async function getAttendanceLogsByDate(date: string): Promise<AttendanceLog[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('date', date)
      .order('time', { ascending: false })
    
    console.log("DATA (getAttendanceLogsByDate):", data)
    console.log("ERROR (getAttendanceLogsByDate):", error)
    
    if (error) {
       console.error("Attendance Log By Date Error:", error)
      return []
    }
    return (data || []).map(log => ({
      ...log,
      employee_name: log.employee_name || 'Unknown',
      type: log.action,
      timestamp: `${log.date}T${log.time}`
    }))
  }
  
  const logs = await getAttendanceLogs()
  return logs.filter(log => log.date === date || log.timestamp?.startsWith(date))
}

export async function getAttendanceByEmployee(employeeId: string): Promise<AttendanceLog[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('employee_id', employeeId)
      .order('date', { ascending: false })
    
    console.log("DATA (getAttendanceByEmployee):", data)
    console.log("ERROR (getAttendanceByEmployee):", error)
    
    if (error) {
      console.error("Attendance Employee Error:", error)
      return []
    }
    return (data || []).map(log => ({
      ...log,
      employee_name: log.employee_name || 'Unknown',
      type: log.action,
      timestamp: `${log.date}T${log.time}`
    }))
  }
  
  const logs = await getAttendanceLogs()
  return logs.filter(log => log.employee_id === employeeId)
}

// ATTENDANCE FIX - Clock In/Out must insert: employee_id, employee_name, date (today), time (now), action, status
export async function addAttendanceLog(log: { employee_id: string; employee_name?: string; type: "clock-in" | "clock-out" }): Promise<AttendanceLog | null> {
  const now = new Date()
  const date = now.toISOString().split('T')[0]
  const time = now.toTimeString().split(' ')[0]
  
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .insert([{
        employee_id: log.employee_id,
        employee_name: log.employee_name,
        date: date,
        time: time,
        action: log.type,
        status: 'present'
      }])
      .select()
      .single()
    
    console.log("DATA (addAttendanceLog):", data)
    console.log("ERROR (addAttendanceLog):", error)
    
    if (error) {
      return null
    }
    return data ? {
      ...data,
      type: data.action,
      timestamp: `${data.date}T${data.time}`
    } : null
  }
  
  // Fallback
  const logs = await getAttendanceLogs()
  const newLog: AttendanceLog = {
    id: generateId('att'),
    employee_id: log.employee_id,
    employee_name: log.employee_name,
    date: date,
    time: time,
    action: log.type,
    status: 'present',
    type: log.type,
    timestamp: now.toISOString()
  }
  logs.unshift(newLog)
  setStoredData(STORAGE_KEYS.attendanceLogs, logs)
  return newLog
}

export async function updateAttendanceLogStatus(id: string, status: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('attendance_logs')
      .update({ status })
      .eq('id', id)
    
    if (error) {
      console.error("ERROR (updateAttendanceLogStatus):", error)
      return false
    }
    return true
  }
  
  const logs = await getAttendanceLogs()
  const index = logs.findIndex(l => l.id === id)
  if (index === -1) return false
  
  logs[index] = { ...logs[index], status }
  setStoredData(STORAGE_KEYS.attendanceLogs, logs)
  return true
}

// Calculate total daily work duration for an employee (in minutes)
// Pairs clock-in/out events chronologically, skips rejected logs
// Returns: { totalMinutes, regularMinutes (max 480 = 8h), overtimeMinutes }
// Calculate total daily work duration for an employee (in minutes)
// Pairs clock-in/out events chronologically, skips rejected logs
// REGULATION: Counts from shift start, caps at shift end, flags lateness
export async function getDailyWorkDuration(employeeId: string, date: string): Promise<{
  totalMinutes: number
  regularMinutes: number
  overtimeMinutes: number
  isLate: boolean
  sessions: { 
    clockIn: string; 
    clockOut: string | null; 
    minutes: number;
    regularMinutes: number;
    overtimeMinutes: number;
    isLate: boolean;
    isAutoClockOut: boolean;
  }[]
}> {
  const logs = await getAttendanceLogsByDate(date)
  const shifts = await getShiftsByEmployee(employeeId)
  const dayShift = shifts.find(s => s.date === date)
  
  const employeeLogs = logs
    .filter(l => l.employee_id === employeeId && l.status !== 'rejected')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const sessions: any[] = []
  let currentInLog: AttendanceLog | null = null

  for (const log of employeeLogs) {
    const action = log.action || log.type
    if (action === 'clock-in') {
      currentInLog = log
    } else if (action === 'clock-out' && currentInLog) {
      const sessionData = calculateRegulatedSession(currentInLog, log, dayShift)
      sessions.push(sessionData)
      currentInLog = null
    }
  }

  // If still clocked in (no clock-out yet), calculate running duration
  if (currentInLog) {
    const sessionData = calculateRegulatedSession(currentInLog, null, dayShift)
    sessions.push(sessionData)
  }

  const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0)
  const regularMinutes = sessions.reduce((sum, s) => sum + s.regularMinutes, 0)
  const overtimeMinutes = sessions.reduce((sum, s) => sum + s.overtimeMinutes, 0)
  const isLate = sessions.some(s => s.isLate)

  return { totalMinutes, regularMinutes, overtimeMinutes, isLate, sessions }
}

// Helper for regulated session calculation
export function calculateRegulatedSession(
  clockInLog: AttendanceLog, 
  clockOutLog: AttendanceLog | null, 
  shift?: ShiftAssignment,
  otStatus: string = "none"
) {
  const clockIn = clockInLog.timestamp
  let clockOut = clockOutLog?.timestamp || null
  
  const cIn = new Date(clockIn)
  let cOut = clockOut ? new Date(clockOut) : new Date()
  let isAutoClockOut = false

  let shiftStart: Date | null = null
  let shiftEnd: Date | null = null

  if (shift) {
    shiftStart = new Date(`${shift.date}T${shift.start_time}`)
    shiftEnd = new Date(`${shift.date}T${shift.end_time}`)
    
    // Handle overnight shifts (e.g. 18:00 to 00:00)
    if (shift.end_time <= shift.start_time) {
      shiftEnd.setDate(shiftEnd.getDate() + 1)
    }
  }

  if (!clockOut) {
    if (shift && shiftEnd) {
      const graceEnd = new Date(shiftEnd.getTime() + 15 * 60000)
      if (cOut > graceEnd) {
        cOut = graceEnd
        isAutoClockOut = true // Forgot to clock out
        clockOut = cOut.toISOString()
      }
    } else {
      const maxEnd = new Date(cIn.getTime() + 8 * 60 * 60000)
      if (cOut > maxEnd) {
        cOut = maxEnd
        isAutoClockOut = true // Auto-end after 8h if no shift
        clockOut = cOut.toISOString()
      }
    }
  }
  
  // Total actual working minutes of the session
  const totalMins = Math.round((cOut.getTime() - cIn.getTime()) / 60000)
  
  let regMins = 0
  let otMins = 0
  let isLate = false
  let lateMinutes = 0
  let isPenalty = false // Late > 15m

  if (shift && shiftStart && shiftEnd) {
    // Rule 1 & 3 & 5 logic
    
    // Rule 3: Early Tap-In (up to 1h early allowed, but calculation starts from shiftStart)
    const oneHourBefore = new Date(shiftStart.getTime() - 60 * 60000)
    const effectiveStartForReg = new Date(Math.max(cIn.getTime(), shiftStart.getTime()))
    
    // Rule 2: Lateness detection (> 15 mins = Penalty)
    const delay = Math.round((cIn.getTime() - shiftStart.getTime()) / 60000)
    if (delay > 0) {
      isLate = true
      lateMinutes = delay
      if (delay > 15) {
        isPenalty = true // Penalty flag
      }
    }
    
    // Rule 5: Auto tap-out grace period (15m)
    const graceEnd = new Date(shiftEnd.getTime() + 15 * 60000)
    const effectiveEndForReg = new Date(Math.min(cOut.getTime(), shiftEnd.getTime()))
    
    if (effectiveEndForReg > effectiveStartForReg) {
      regMins = Math.round((effectiveEndForReg.getTime() - effectiveStartForReg.getTime()) / 60000)
      // Rule 1: Max 8 hours (480 mins) regular per day
      // Note: Since this is per session, we should cap it in the daily sum too, but let's cap here for safety
      regMins = Math.min(regMins, 480) 
    }

    if (clockOutLog && cOut > graceEnd) {
      isAutoClockOut = true
      // Auto tap-out means no overtime counted from this session
      otMins = 0
    } else if (otStatus === 'approved') {
      // Rule 4: Only approved OT sessions count
      // This session is flagged as approved OT (usually separate from reg shift)
      // Any time outside the regular shift bounds in this session is OT
      const nonRegMins = Math.max(0, totalMins - regMins)
      otMins = nonRegMins
    }
  } else {
    // No shift scheduled - session only counts if it's an approved OT
    if (otStatus === 'approved') {
      otMins = totalMins
    }
  }

  return {
    clockIn,
    clockOut: clockOut,
    minutes: totalMins,
    regularMinutes: regMins,
    overtimeMinutes: otMins,
    isLate,
    lateMinutes,
    isPenalty,
    isAutoClockOut,
    otStatus
  }
}

// Bulk fetch log range
export async function getAttendanceLogsInRange(startDate: string, endDate: string): Promise<AttendanceLog[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
    
    if (error) return []
    return (data || []).map(log => ({
      ...log,
      employee_name: log.employee_name || 'Unknown',
      type: log.action || log.type,
      timestamp: `${log.date}T${log.time}`
    }))
  }
  return []
}

// Bulk fetch shift range (FIXED TABLE NAME: 'shifts')
export async function getShiftAssignmentsInRange(startDate: string, endDate: string): Promise<ShiftAssignment[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
    
    if (error) return []
    return data || []
  }
  return []
}

// Bulk fetch overtime range
export async function getOvertimeRequestsInRange(startDate: string, endDate: string): Promise<OvertimeRequest[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('overtime_requests')
      .select('*')
      .gte('request_date', startDate)
      .lte('request_date', endDate)
    
    if (error) return []
    return data || []
  }
  return []
}

// New function for attendance report data (OPTIMIZED & FIXED)
export async function getAttendanceReportData(startDate: string, endDate: string) {
  const [employees, allLogs, allShifts, allOT] = await Promise.all([
    getEmployees(),
    getAttendanceLogsInRange(startDate, endDate),
    getShiftAssignmentsInRange(startDate, endDate),
    getOvertimeRequestsInRange(startDate, endDate)
  ])
  
  const report = []
  
  // Group logs by employee_id and date
  const logsMap = new Map<string, AttendanceLog[]>()
  for (const log of allLogs) {
    const key = `${log.employee_id}_${log.date}`
    if (!logsMap.has(key)) logsMap.set(key, [])
    logsMap.get(key)!.push(log)
  }
  
  // Group shifts by employee_id and date
  const shiftsMap = new Map<string, ShiftAssignment>()
  for (const shift of allShifts) {
    const key = `${shift.employee_id}_${shift.date}`
    shiftsMap.set(key, shift)
  }

  // Create OT Map for quick lookup by attendance_log_id
  const otMap = new Map<string, OvertimeRequest>()
  for (const ot of allOT) {
    if (ot.attendance_log_id) {
       otMap.set(ot.attendance_log_id, ot)
    }
  }
  
  // Create a list of dates between start and end using local date logic
  const dateList: string[] = []
  
  // Create dates from startDate to endDate safely in local context
  const sParts = startDate.split('-').map(Number)
  const eParts = endDate.split('-').map(Number)
  const start = new Date(sParts[0], sParts[1]-1, sParts[2])
  const end = new Date(eParts[0], eParts[1]-1, eParts[2])
  
  let curr = new Date(start)
  while (curr <= end) {
    // build YYYY-MM-DD manually to avoid any timezone shifting
    const y = curr.getFullYear()
    const m = String(curr.getMonth() + 1).padStart(2, '0')
    const d = String(curr.getDate()).padStart(2, '0')
    dateList.push(`${y}-${m}-${d}`)
    curr.setDate(curr.getDate() + 1)
  }
  
  // Iterate newest first
  for (const dateStr of dateList.reverse()) {
    for (const emp of employees) {
      const key = `${emp.id}_${dateStr}`
      const empDayLogs = logsMap.get(key) || []
      const empDayShift = shiftsMap.get(key)
      
      if (empDayLogs.length > 0) {
        // Calculate duration logic fully in-memory
        const sessions: any[] = []
        let currentInLog: AttendanceLog | null = null

        const sortedLogs = [...empDayLogs].sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )

        for (const log of sortedLogs) {
          const action = log.action || log.type
          if (action === 'clock-in') {
            currentInLog = log
          } else if (action === 'clock-out' && currentInLog) {
            // Rule 4: Check if this session is an approved Overtime session
            const otReq = otMap.get(currentInLog.id)
            const otStatus = otReq?.status || 'none'

            const sessionData = calculateRegulatedSession(currentInLog, log, empDayShift, otStatus)
            sessions.push(sessionData)
            currentInLog = null
          }
        }

        if (currentInLog) {
          const otReq = otMap.get(currentInLog.id)
          const otStatus = otReq?.status || 'none'
          const sessionData = calculateRegulatedSession(currentInLog, null, empDayShift, otStatus)
          sessions.push(sessionData)
        }

        if (sessions.length > 0) {
          let regularMinutes = sessions.reduce((sum, s) => sum + s.regularMinutes, 0)
          // Rule 1: Max 8 hours per day
          regularMinutes = Math.min(regularMinutes, 480)
          
          const overtimeMinutes = sessions.reduce((sum, s) => sum + s.overtimeMinutes, 0)
          const isLate = sessions.some(s => s.isLate)
          const isPenalty = sessions.some(s => s.isPenalty)
          const lateMinutes = sessions.reduce((max, s) => Math.max(max, s.lateMinutes || 0), 0)

          report.push({
            employee_id: emp.id,
            employee_name: emp.name,
            date: dateStr,
            regularMinutes,
            overtimeMinutes,
            isLate,
            isPenalty,
            lateMinutes,
            sessions
          })
        }
      }
    }
  }
  
  return report
}

// New function for attendance statistics (Dashboard)
export async function getAttendanceStats(employeeId?: string) {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  
  const reportData = await getAttendanceReportData(firstDay, lastDay)
  
  if (employeeId) {
    const empData = reportData.filter(r => r.employee_id === employeeId)
    const totalRegHours = empData.reduce((sum, r) => sum + r.regularMinutes / 60, 0)
    const totalOTHours = empData.reduce((sum, r) => sum + r.overtimeMinutes / 60, 0)
    const lateCount = empData.filter(r => r.isLate).length
    const penaltyCount = empData.filter(r => r.isPenalty).length
    
    return { 
      totalHours: totalRegHours + totalOTHours, 
      totalRegHours,
      totalOTHours,
      lateCount, 
      penaltyCount,
      entryCount: empData.length 
    }
  }
  
  // Admin stats: Ranking by lateness/penalty
  const stats: Record<string, { name: string; lateCount: number; penaltyCount: number; totalHours: number }> = {}
  for (const r of reportData) {
    if (!stats[r.employee_id]) {
      stats[r.employee_id] = { name: r.employee_name, lateCount: 0, penaltyCount: 0, totalHours: 0 }
    }
    if (r.isLate) stats[r.employee_id].lateCount++
    if (r.isPenalty) stats[r.employee_id].penaltyCount++
    stats[r.employee_id].totalHours += (r.regularMinutes + r.overtimeMinutes) / 60
  }
  
  return Object.values(stats).sort((a, b) => b.penaltyCount - a.penaltyCount || b.lateCount - a.lateCount)
}

export async function getTodayAttendance(): Promise<AttendanceLog[]> {
  const today = getLocalYYYYMMDD()
  return getAttendanceLogsByDate(today)
}

// ========== MENU ITEMS ==========
// DB Schema: menu_items(id, name, type, price, status)

export async function getMenuItems(): Promise<MenuItem[]> {
  if (isSupabaseConfigured()) {
    // 1. Fetch menu items
    const { data: menuData, error: menuError } = await supabase
      .from('menu_items')
      .select('*')
      .order('name', { ascending: true })
    
    if (menuError || !menuData) {
      console.log("ERROR (getMenuItems):", menuError)
      return []
    }

    // 2. Fetch all recipes
    const { data: recipesData } = await supabase
      .from('menu_recipes')
      .select('*')
      
    // Group recipes by menu_item_id
    const recipesByMenu: Record<string, any[]> = {}
    if (recipesData) {
      recipesData.forEach(r => {
        if (!recipesByMenu[r.menu_item_id]) recipesByMenu[r.menu_item_id] = []
        recipesByMenu[r.menu_item_id].push({
          item_id: r.inventory_item_id,
          amount: r.quantity,
          unit: r.unit
        })
      })
    }

    // Map type to category, and attach grouped recipes
    return menuData.map(item => ({
      ...item,
      category: item.type,
      recipe: recipesByMenu[item.id] ? { ingredients: recipesByMenu[item.id] } : undefined
    }))
  }
  
  return getStoredData(STORAGE_KEYS.menuItems, mockMenuItems as MenuItem[])
}

// MENU FIX - Add menu must use only: name, type, price, status
// FIX DUPLICATE MENU: Check if menu exists before adding
// IF EXISTS: Update existing record instead of inserting duplicate
export async function addMenuItem(item: { name: string; type: string; price: number; packaging_cost?: number; status?: string; category?: string }): Promise<MenuItem | null> {
  if (isSupabaseConfigured()) {
  // STEP 1: Check if menu_items WHERE name = input_name EXISTS
  const { data: existingItem, error: checkError } = await supabase
    .from('menu_items')
    .select('*')
    .eq('name', item.name)
    .single()
  
  console.log("CHECK EXISTING (addMenuItem):", existingItem)
  
  // IF EXISTS: Update existing record instead of inserting duplicate
    if (existingItem && !checkError) {
      console.log("MENU EXISTS - UPDATING instead of inserting duplicate")
      const { data: updatedData, error: updateError } = await supabase
        .from('menu_items')
        .update({
          type: item.type,
          price: item.price,
          packaging_cost: (item as any).packaging_cost || 0,
          status: item.status || 'active'
        })
        .eq('id', existingItem.id)
      .select()
      .single()
    
    console.log("DATA (addMenuItem UPDATE):", updatedData)
    console.log("ERROR (addMenuItem UPDATE):", updateError)
    
    if (updateError) {
      return null
    }
    return updatedData ? { ...updatedData, category: updatedData.type } : null
  }
  
  // IF NOT EXISTS: Insert new
  const { data, error } = await supabase
  .from('menu_items')
  .insert([{
    name: item.name,
    type: item.type,
    price: item.price,
    packaging_cost: (item as any).packaging_cost || 0,
    status: item.status || 'active'
  }])
  .select()
  .single()
  
  console.log("DATA (addMenuItem INSERT):", data)
  console.log("ERROR (addMenuItem INSERT):", error)
  
  if (error) {
  return null
  }
  return data ? { ...data, category: data.type } : null
  }
  
  const items = await getMenuItems()
  const newItem: MenuItem = {
    id: generateId('menu'),
    name: item.name,
    type: item.type as "coffee" | "non-coffee" | "food",
    price: item.price,
    status: (item.status || 'active') as "active" | "inactive",
    packaging_cost: item.packaging_cost || 0,
    category: item.type as "coffee" | "non-coffee" | "food"
  }
  items.push(newItem)
  setStoredData(STORAGE_KEYS.menuItems, items)
  return newItem
}

export async function updateMenuItem(id: string, updates: Partial<MenuItem>): Promise<MenuItem | null> {
  if (isSupabaseConfigured()) {
    // Only update fields that exist in DB schema
    const dbUpdates: Record<string, unknown> = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.type !== undefined) dbUpdates.type = updates.type
    if (updates.category !== undefined) dbUpdates.type = updates.category // Map category to type
    if (updates.price !== undefined) dbUpdates.price = updates.price
    if (updates.packaging_cost !== undefined) dbUpdates.packaging_cost = updates.packaging_cost
    if (updates.status !== undefined) dbUpdates.status = updates.status
    
    const { data, error } = await supabase
      .from('menu_items')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single()
    
    console.log("DATA (updateMenuItem):", data)
    console.log("ERROR (updateMenuItem):", error)
    
    if (error) {
      return null
    }
    return data ? { ...data, category: data.type } : null
  }
  
  const items = await getMenuItems()
  const index = items.findIndex(i => i.id === id)
  if (index === -1) return null
  items[index] = { ...items[index], ...updates }
  setStoredData(STORAGE_KEYS.menuItems, items)
  return items[index]
}

export async function deleteMenuItem(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id)
    
    console.log("ERROR (deleteMenuItem):", error)
    
    if (error) {
      return false
    }
    return true
  }
  
  const items = await getMenuItems()
  const filtered = items.filter(i => i.id !== id)
  setStoredData(STORAGE_KEYS.menuItems, filtered)
  return true
}

// ========== SHIFT ASSIGNMENTS ==========
// DB Schema: shifts(id, employee_id, date, start_time, end_time)

export async function getShiftAssignments(): Promise<ShiftAssignment[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('shifts')
      .select('*, employees(name)')
      .order('date', { ascending: true })
    
    if (error) {
      console.error("ERROR (getShiftAssignments):", error.message)
      return []
    }

    // Map the joined data to include employee_name
    return (data || []).map(shift => ({
      ...shift,
      employee_name: (shift.employees as any)?.name || 'Unknown'
    })) as ShiftAssignment[]
  }
  
  const stored = getStoredData(STORAGE_KEYS.shiftAssignments, mockShiftAssignments)
  return stored.map(shift => ({
    id: shift.id,
    employee_id: 'employee_id' in shift ? shift.employee_id : (shift as { employeeId: string }).employeeId,
    employee_name: 'employee_name' in shift ? shift.employee_name : (shift as { employeeName: string }).employeeName,
    date: shift.date,
    day_of_week: 'day_of_week' in shift ? shift.day_of_week : (shift as { dayOfWeek: number }).dayOfWeek,
    start_time: 'start_time' in shift ? shift.start_time : (shift as { startTime: string }).startTime,
    end_time: 'end_time' in shift ? shift.end_time : (shift as { endTime: string }).endTime
  })) as ShiftAssignment[]
}

export async function getShiftsByDate(date: string): Promise<ShiftAssignment[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('shifts')
      .select('*, employees(name)')
      .eq('date', date)
    
    if (error) {
      console.error("ERROR (getShiftsByDate):", error.message)
      return []
    }
    
    return (data || []).map(shift => ({
      ...shift,
      employee_name: (shift.employees as any)?.name || 'Unknown'
    })) as ShiftAssignment[]
  }
  
  const shifts = await getShiftAssignments()
  return shifts.filter(s => s.date === date)
}

export async function getShiftsByEmployee(employeeId: string): Promise<ShiftAssignment[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('shifts')
      .select('*, employees(name)')
      .eq('employee_id', employeeId)
      .order('date', { ascending: true })
    
    if (error) {
      console.error("ERROR (getShiftsByEmployee):", error.message)
      return []
    }
    
    return (data || []).map(shift => ({
      ...shift,
      employee_name: (shift.employees as any)?.name || 'Unknown'
    })) as ShiftAssignment[]
  }
  
  const shifts = await getShiftAssignments()
  return shifts.filter(s => s.employee_id === employeeId).sort((a, b) => a.date.localeCompare(b.date))
}

export async function hasShiftOnDate(employeeId: string, date: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('shifts')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('date', date)
      .single()
    
    return !error && data !== null
  }
  
  const shifts = await getShiftAssignments()
  return shifts.some(s => s.employee_id === employeeId && s.date === date)
}

// SCHEDULING FIX - Insert into shifts: employee_id, date, start_time, end_time, shift_config_id (optional)
export async function addShiftAssignment(assignment: { 
  employee_id: string; 
  date: string; 
  start_time: string; 
  end_time: string; 
  employee_name?: string;
  shift_config_id?: string;
  shift_name?: string;
  day_of_week?: number;
}): Promise<ShiftAssignment | null> {
  console.log("[v0] addShiftAssignment (UPSERT) called with:", assignment)
  
  if (isSupabaseConfigured()) {
    // Check if a shift already exists for this employee on this date
    const { data: existing } = await supabase
      .from('shifts')
      .select('id')
      .eq('employee_id', assignment.employee_id)
      .eq('date', assignment.date)
      .maybeSingle()

    const shiftData: any = {
      employee_id: assignment.employee_id,
      date: assignment.date,
      start_time: assignment.start_time,
      end_time: assignment.end_time,
      shift_config_id: assignment.shift_config_id || null
    }

    if (existing) {
      console.log("[v0] Updating existing shift:", existing.id)
      const { data, error } = await supabase
        .from('shifts')
        .update(shiftData)
        .eq('id', existing.id)
        .select('*, employees(name)')
        .single()
      
      if (error) {
        console.error("Shift update error:", error.message)
        return null
      }
      return {
        ...data,
        employee_name: (data.employees as any)?.name || assignment.employee_name || 'Unknown'
      } as ShiftAssignment
    } else {
      console.log("[v0] Inserting new shift")
      const { data, error } = await supabase
        .from('shifts')
        .insert([shiftData])
        .select('*, employees(name)')
        .single()
      
      if (error) {
        console.error("Shift insert error:", error.message)
        return null
      }
      return {
        ...data,
        employee_name: (data.employees as any)?.name || assignment.employee_name || 'Unknown'
      } as ShiftAssignment
    }
  }
  
  // Fallback for localStorage
  const shifts = await getShiftAssignments()
  const existingIdx = shifts.findIndex(s => s.employee_id === assignment.employee_id && s.date === assignment.date)
  
  if (existingIdx >= 0) {
    shifts[existingIdx] = { ...shifts[existingIdx], ...assignment }
    setStoredData(STORAGE_KEYS.shiftAssignments, shifts)
    return shifts[existingIdx]
  } else {
    const newShift: ShiftAssignment = {
      ...assignment,
      id: generateId('shift')
    }
    shifts.push(newShift)
    setStoredData(STORAGE_KEYS.shiftAssignments, shifts)
    return newShift
  }
}

export async function deleteShiftAssignment(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', id)
    
    console.log("ERROR (deleteShiftAssignment):", error)
    
    if (error) {
      return false
    }
    return true
  }
  
  const shifts = await getShiftAssignments()
  const filtered = shifts.filter(s => s.id !== id)
  setStoredData(STORAGE_KEYS.shiftAssignments, filtered)
  return true
}

export async function getShiftAssignmentById(id: string): Promise<ShiftAssignment | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) return null
    return data
  }
  
  const shifts = await getShiftAssignments()
  return shifts.find(s => s.id === id) || null
}

export async function updateShiftAssignment(id: string, updates: Partial<ShiftAssignment>): Promise<ShiftAssignment | null> {
  if (isSupabaseConfigured()) {
    // Only include valid database columns
    const updateData: any = {}
    if (updates.employee_id) updateData.employee_id = updates.employee_id
    if (updates.date) updateData.date = updates.date
    if (updates.start_time) updateData.start_time = updates.start_time
    if (updates.end_time) updateData.end_time = updates.end_time
    if (updates.shift_config_id) updateData.shift_config_id = updates.shift_config_id
    
    console.log("[v0] updateShiftAssignment calling supabase with payload:", updateData)
    
    const { data, error } = await supabase
      .from('shifts')
      .update(updateData)
      .eq('id', id)
      .select('*, employees(name)')
      .single()
    
    if (error) {
      console.error("ERROR (updateShiftAssignment):", error.message || error)
      return null
    }
    return {
      ...data,
      employee_name: (data.employees as any)?.name || updates.employee_name || 'Unknown'
    } as ShiftAssignment
  }
  
  const shifts = await getShiftAssignments()
  const index = shifts.findIndex(s => s.id === id)
  if (index === -1) return null
  
  shifts[index] = { ...shifts[index], ...updates }
  setStoredData(STORAGE_KEYS.shiftAssignments, shifts)
  return shifts[index]
}

// ========== OVERTIME REQUESTS ==========

export async function getOvertimeRequests(): Promise<OvertimeRequest[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('overtime_requests')
      .select('*')
      .order('request_date', { ascending: false })
    
    console.log("DATA (getOvertimeRequests):", data)
    console.log("ERROR (getOvertimeRequests):", error)
    
    if (error) {
      return []
    }
    return data || []
  }
  
  const stored = getStoredData(STORAGE_KEYS.overtimeRequests, mockOvertimeRequests)
  return stored.map(req => ({
    id: req.id,
    employee_id: 'employee_id' in req ? req.employee_id : (req as { employeeId: string }).employeeId,
    employee_name: 'employee_name' in req ? req.employee_name : (req as { employeeName: string }).employeeName,
    attendance_log_id: 'attendance_log_id' in req ? req.attendance_log_id : (req as { attendanceLogId: string }).attendanceLogId,
    request_date: 'request_date' in req ? req.request_date : (req as { requestDate: string }).requestDate,
    clock_in_time: 'clock_in_time' in req ? req.clock_in_time : (req as { clockInTime: string }).clockInTime,
    status: req.status,
    reviewed_by: 'reviewed_by' in req ? req.reviewed_by : (req as { reviewedBy?: string }).reviewedBy,
    reviewed_at: 'reviewed_at' in req ? req.reviewed_at : (req as { reviewedAt?: string }).reviewedAt,
    notes: req.notes
  })) as OvertimeRequest[]
}

export async function getPendingOvertimeRequests(): Promise<OvertimeRequest[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('overtime_requests')
      .select('*')
      .eq('status', 'pending')
      .order('request_date', { ascending: false })
    
    console.log("DATA (getPendingOvertimeRequests):", data)
    console.log("ERROR (getPendingOvertimeRequests):", error)
    
    if (error) {
      return []
    }
    return data || []
  }
  
  const requests = await getOvertimeRequests()
  return requests.filter(r => r.status === 'pending')
}

export async function addOvertimeRequest(request: Omit<OvertimeRequest, 'id'>): Promise<OvertimeRequest | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('overtime_requests')
      .insert([request])
      .select()
      .single()
    
    console.log("DATA (addOvertimeRequest):", data)
    console.log("ERROR (addOvertimeRequest):", error)
    
    if (error) {
      return null
    }
    return data
  }
  
  const requests = await getOvertimeRequests()
  const newRequest: OvertimeRequest = {
    ...request,
    id: generateId('ot')
  }
  requests.unshift(newRequest)
  setStoredData(STORAGE_KEYS.overtimeRequests, requests)
  return newRequest
}

export async function approveOvertimeRequest(id: string, reviewerName: string): Promise<OvertimeRequest | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('overtime_requests')
      .update({
        status: 'approved',
        reviewed_by: reviewerName,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (!error && data?.attendance_log_id) {
      await updateAttendanceLogStatus(data.attendance_log_id, 'approved')
    }
    
    return data
  }
  
  const requests = await getOvertimeRequests()
  const index = requests.findIndex(r => r.id === id)
  if (index === -1) return null
  
  const updatedReq = {
    ...requests[index],
    status: 'approved' as const,
    reviewed_by: reviewerName,
    reviewed_at: new Date().toISOString()
  }
  
  requests[index] = updatedReq
  setStoredData(STORAGE_KEYS.overtimeRequests, requests)
  
  if (updatedReq.attendance_log_id) {
    await updateAttendanceLogStatus(updatedReq.attendance_log_id, 'approved')
  }
  
  return requests[index]
}

export async function rejectOvertimeRequest(id: string, reviewerName: string, notes?: string): Promise<OvertimeRequest | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('overtime_requests')
      .update({
        status: 'rejected',
        reviewed_by: reviewerName,
        reviewed_at: new Date().toISOString(),
        notes
      })
      .eq('id', id)
      .select()
      .single()
    
    if (!error && data?.attendance_log_id) {
      await updateAttendanceLogStatus(data.attendance_log_id, 'rejected')
    }

    return data
  }
  
  const requests = await getOvertimeRequests()
  const index = requests.findIndex(r => r.id === id)
  if (index === -1) return null
  
  const updatedReq = {
    ...requests[index],
    status: 'rejected' as const,
    reviewed_by: reviewerName,
    reviewed_at: new Date().toISOString(),
    notes
  }
  
  requests[index] = updatedReq
  setStoredData(STORAGE_KEYS.overtimeRequests, requests)
  
  if (updatedReq.attendance_log_id) {
    await updateAttendanceLogStatus(updatedReq.attendance_log_id, 'rejected')
  }
  
  return requests[index]
}

// ========== HELPER FUNCTIONS ==========

export function getStockHealth(item: InventoryItem): "healthy" | "warning" | "critical" {
  const stock = item.stock || item.current_stock || 0
  const dailyUsage = item.daily_usage || 1
  const daysRemaining = stock / dailyUsage
  if (daysRemaining <= 1) return "critical"
  if (daysRemaining <= 3) return "warning"
  return "healthy"
}

export function getDaysRemaining(item: InventoryItem): number {
  const stock = item.stock || item.current_stock || 0
  const dailyUsage = item.daily_usage || 1
  return Math.round((stock / dailyUsage) * 10) / 10
}

export function getOverallStockHealth(inventory: InventoryItem[]): number {
  if (inventory.length === 0) return 100
  const healthyItems = inventory.filter(item => getStockHealth(item) === "healthy").length
  return Math.round((healthyItems / inventory.length) * 100)
}

export function getLowStockItems(inventory: InventoryItem[]) {
  return inventory
    .map(item => ({ ...item, daysRemaining: getDaysRemaining(item) }))
    .filter(item => item.daysRemaining <= 5)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
}

export function getOperationalCapacity(inventory: InventoryItem[]): number {
  if (inventory.length === 0) return 0
  const criticalItems = inventory.filter(item => getStockHealth(item) === "critical")
  if (criticalItems.length > 0) return 1
  
  const minDays = Math.min(...inventory.map(item => getDaysRemaining(item)))
  return Math.round(minDays * 10) / 10
}

export function getPurchaseRecommendations(inventory: InventoryItem[]) {
  return inventory
    .filter(item => getDaysRemaining(item) <= 7)
    .map(item => {
      const coverageDays = 7
      const dailyUsage = item.daily_usage || 1
      const recommendedQty = Math.ceil(dailyUsage * coverageDays)
      return { item, recommendedQty, coverageDays }
    })
    .sort((a, b) => getDaysRemaining(a.item) - getDaysRemaining(b.item))
}

// Helper to check if a date is a weekend (Saturday = 6, Sunday = 0)
export function isWeekend(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = d.getDay()
  return day === 0 || day === 6 // Sunday or Saturday
}

// Get day type for a date
export function getDayType(date: Date | string): "weekday" | "weekend" {
  return isWeekend(date) ? "weekend" : "weekday"
}

// Get shift configs filtered by day type
export async function getShiftConfigsByDayType(dayType: "weekday" | "weekend"): Promise<ShiftConfig[]> {
  const configs = await getShiftConfigs()
  return configs.filter(c => c.day_type === dayType || !c.day_type)
}

// Get on-shift employees based on today's attendance
export async function getOnShiftEmployees(): Promise<Employee[]> {
  const today = getLocalYYYYMMDD()
  const todayLogs = await getAttendanceLogsByDate(today)
  const employees = await getActiveEmployees()
  
  const clockedIn = new Set<string>()
  
  // Sort logs chronologically and process
  const sortedLogs = [...todayLogs].sort((a, b) => {
    const timeA = a.timestamp || `${a.date}T${a.time}`
    const timeB = b.timestamp || `${b.date}T${b.time}`
    return new Date(timeA).getTime() - new Date(timeB).getTime()
  })
  
  sortedLogs.forEach(log => {
    // skip rejected logs
    if (log.status === 'rejected') return
    
    const action = log.action || log.type
    if (action === "clock-in") {
      clockedIn.add(log.employee_id)
    } else {
      clockedIn.delete(log.employee_id)
    }
  })
  
  return employees.filter(emp => clockedIn.has(emp.id))
}

// ========== SHIFT CONFIGURATIONS ==========

export async function getShiftConfigs(): Promise<ShiftConfig[]> {
  console.log("[v0] getShiftConfigs called")
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('shift_configs')
      .select('*')
      .order('start_time', { ascending: true })
    
    console.log("[v0] getShiftConfigs - DATA:", data)
    console.log("[v0] getShiftConfigs - ERROR:", error)
    
    if (error) {
      console.error("[v0] Error fetching shift configs:", error)
      return []
    }
    return data || []
  }
  
  console.log("[v0] getShiftConfigs - using localStorage fallback")
  return getStoredData(STORAGE_KEYS.shiftConfigs, mockShiftConfigs as ShiftConfig[])
}

export async function getShiftConfigById(id: string): Promise<ShiftConfig | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('shift_configs')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      return null
    }
    return data
  }
  
  const configs = await getShiftConfigs()
  return configs.find(c => c.id === id) || null
}

export async function addShiftConfig(config: Omit<ShiftConfig, 'id'>): Promise<ShiftConfig | null> {
  console.log("[v0] addShiftConfig called with:", config)
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('shift_configs')
      .insert(config)
      .select()
      .single()
    
    console.log("[v0] addShiftConfig - DATA:", data)
    console.log("[v0] addShiftConfig - ERROR:", error)
    
    if (error) {
      console.error("[v0] Error adding shift config:", error)
      return null
    }
    return data
  }
  
  const configs = await getShiftConfigs()
  const newConfig: ShiftConfig = {
    id: generateId('shift-config'),
    ...config
  }
  configs.push(newConfig)
  setStoredData(STORAGE_KEYS.shiftConfigs, configs)
  return newConfig
}

export async function updateShiftConfig(id: string, updates: Partial<Omit<ShiftConfig, 'id'>>): Promise<ShiftConfig | null> {
  console.log("[v0] updateShiftConfig called with id:", id, "updates:", updates)
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('shift_configs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    console.log("[v0] updateShiftConfig - DATA:", data)
    console.log("[v0] updateShiftConfig - ERROR:", error)
    
    if (error) {
      console.error("[v0] Error updating shift config:", error)
      return null
    }

    // CASCADE UPDATE: If start_time or end_time changed, update future shifts
    if (updates.start_time || updates.end_time) {
      console.log("[v0] Cascading shift config update to future shifts...")
      const today = new Date().toISOString().split('T')[0]
      
      const shiftUpdates: Record<string, string> = {}
      if (updates.start_time) shiftUpdates.start_time = updates.start_time
      if (updates.end_time) shiftUpdates.end_time = updates.end_time

      const { error: cascadeError } = await supabase
        .from('shifts')
        .update(shiftUpdates)
        .eq('shift_config_id', id)
        .gte('date', today)
      
      if (cascadeError) {
        console.error("[v0] Error cascading shift updates:", cascadeError)
      } else {
        console.log("[v0] Successfully cascaded shift updates to future assignments")
      }
    }

    return data
  }
  
  const configs = await getShiftConfigs()
  const index = configs.findIndex(c => c.id === id)
  if (index === -1) return null
  
  configs[index] = { ...configs[index], ...updates }
  setStoredData(STORAGE_KEYS.shiftConfigs, configs)
  return configs[index]
}

export async function deleteShiftConfig(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('shift_configs')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error("Error deleting shift config:", error)
      return false
    }
    return true
  }
  
  const configs = await getShiftConfigs()
  const filtered = configs.filter(c => c.id !== id)
  setStoredData(STORAGE_KEYS.shiftConfigs, filtered)
  return true
}

// ========== SYSTEM ACTIVITY LOGS ==========

export async function getSystemLogs(): Promise<SystemLog[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('system_logs')
      .select('*')
      .order('timestamp', { ascending: false })
    
    console.log("DATA (getSystemLogs):", data)
    console.log("ERROR (getSystemLogs):", error)
    
    if (error) {
      // Table might not exist, return localStorage fallback
      return getStoredData(STORAGE_KEYS.systemLogs, [] as SystemLog[])
    }
    return data || []
  }
  
  return getStoredData(STORAGE_KEYS.systemLogs, [] as SystemLog[])
}

export async function addSystemLog(log: Omit<SystemLog, 'id' | 'timestamp'>): Promise<SystemLog | null> {
  const newLog: SystemLog = {
    ...log,
    id: generateId('syslog'),
    timestamp: new Date().toISOString()
  }
  
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('system_logs')
      .insert([newLog])
      .select()
      .single()
    
    console.log("DATA (addSystemLog):", data)
    console.log("ERROR (addSystemLog):", error)
    
    if (error) {
      // Table might not exist, save to localStorage
      const logs = getStoredData(STORAGE_KEYS.systemLogs, [] as SystemLog[])
      logs.unshift(newLog)
      setStoredData(STORAGE_KEYS.systemLogs, logs)
      return newLog
    }
    return data
  }
  
  const logs = getStoredData(STORAGE_KEYS.systemLogs, [] as SystemLog[])
  logs.unshift(newLog)
  setStoredData(STORAGE_KEYS.systemLogs, logs)
  return newLog
}

// Helper function to log system activities
export async function logActivity(
  action: SystemLog['action'],
  actor: string,
  target: string,
  details: string
): Promise<void> {
  await addSystemLog({ action, actor, target, details })
}

// ========== HPP (Harga Pokok Penjualan) ==========
// Call RPC: get_menu_hpp(menu_id) to get cost of goods sold for a menu

export async function getMenuHpp(menuId: string): Promise<number> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.rpc('get_menu_hpp', {
      p_menu_id: menuId
    })
    
    console.log("DATA (getMenuHpp):", data)
    console.log("ERROR (getMenuHpp):", error)
    
    if (error) {
      // If RPC doesn't exist, calculate manually from recipes and inventory
      return calculateMenuHppManually(menuId)
    }
    
    return data || 0
  }
  
  return calculateMenuHppManually(menuId)
}

// Manual HPP calculation when RPC is not available
// Optionally includes overhead allocation (divided equally among totalMenusSold)
async function calculateMenuHppManually(menuId: string): Promise<number> {
  const recipes = await getMenuRecipes(menuId)
  const inventory = await getInventory()
  
  let totalCost = 0
  for (const recipe of recipes) {
    const item = inventory.find(i => i.id === recipe.inventory_item_id)
    if (item && item.unit_cost) {
      totalCost += recipe.quantity * item.unit_cost
    }
  }
  
  return totalCost
}

// Full COGS calculation including overhead per menu item
export async function getMenuCOGS(menuId: string, month?: string, totalMenusSold?: number): Promise<{ ingredientCost: number; overheadPerItem: number; totalCOGS: number }> {
  const ingredientCost = await calculateMenuHppManually(menuId)
  
  let overheadPerItem = 0
  if (month && totalMenusSold && totalMenusSold > 0) {
    const opexList = await getMonthlyOpex(month)
    const totalOverhead = opexList.reduce((sum, o) => sum + o.amount, 0)
    overheadPerItem = totalOverhead / totalMenusSold
  }
  
  return {
    ingredientCost,
    overheadPerItem,
    totalCOGS: ingredientCost + overheadPerItem
  }
}

// Bulk get HPP for multiple menus
export async function getMenusHpp(menuIds: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  
  // Fetch all in parallel
  const hppPromises = menuIds.map(async (menuId) => {
    const hpp = await getMenuHpp(menuId)
    return { menuId, hpp }
  })
  
  const hppResults = await Promise.all(hppPromises)
  
  for (const { menuId, hpp } of hppResults) {
    result[menuId] = hpp
  }
  
  return result
}

// ========== BULK SELL MENU ==========
// Call RPC: bulk_sell_menu(menu_ids[], quantities[]) for daily sales input

export interface BulkSaleItem {
  menu_id: string
  quantity: number
}

export async function bulkSellMenu(items: BulkSaleItem[]): Promise<boolean> {
  if (isSupabaseConfigured()) {
    // Try new FIFO RPC first (process_menu_sales_fifo)
    const { error: fifoError } = await supabase.rpc('process_menu_sales_fifo', {
      p_menu_ids: items.map(i => i.menu_id),
      p_quantities: items.map(i => i.quantity)
    })
    
    if (!fifoError) {
      console.log("SUCCESS: bulkSellMenu via FIFO RPC")
      return true
    }
    
    console.log("FIFO RPC not available, trying legacy bulk_sell_menu:", fifoError.message)
    
    // Try legacy RPC
    const { error: rpcError } = await supabase.rpc('bulk_sell_menu', {
      p_menu_ids: items.map(i => i.menu_id),
      p_quantities: items.map(i => i.quantity)
    })
    
    if (!rpcError) {
      return true
    }
    
    // If RPC doesn't exist, fall back to individual sellMenu calls
    console.log("RPC bulk_sell_menu not found, falling back to individual calls")
    
    for (const item of items) {
      const success = await sellMenu(item.menu_id, item.quantity)
      if (!success) {
        console.log("Failed to sell menu:", item.menu_id)
        return false
      }
    }
    
    return true
  }
  
  // Fallback - no local implementation
  return false
}

// ========== SALES LOGS WITH DATE GROUPING ==========

export interface SalesLogGrouped {
  date: string
  logs: SalesLog[]
  total_quantity: number
  total_revenue: number
}

export async function getSalesLogsGroupedByDate(): Promise<SalesLogGrouped[]> {
  const logs = await getSalesLogs()
  
  // Group by date
  const grouped: Record<string, SalesLog[]> = {}
  
  for (const log of logs) {
    const date = new Date(log.created_at).toISOString().split('T')[0]
    if (!grouped[date]) {
      grouped[date] = []
    }
    grouped[date].push(log)
  }
  
  // Convert to array with totals
  return Object.entries(grouped)
    .map(([date, logs]) => ({
      date,
      logs,
      total_quantity: logs.reduce((sum, l) => sum + l.quantity, 0),
      total_revenue: logs.reduce((sum, l) => sum + l.total_price, 0)
    }))
    .sort((a, b) => b.date.localeCompare(a.date)) // Most recent first
}

// ========== ADD BATCH (STOCK IN) ==========
// This is the main entry point for adding stock
// INPUT: item_id, quantity, unit, unit_cost, supplier_name, received_date, expired_date, notes
// Auto-generates batch_number: CATEGORY-YYYYMMDD-HHMMSS
// 
// DATABASE BEHAVIOR:
// 1. INSERT into inventory_batches (item_id, quantity, remaining_quantity, cost_per_unit, supplier_name, received_date, expired_date, notes, batch_number)
// 2. UPDATE inventory_items: stock = stock + quantity
// 3. INSERT into inventory_transactions: type = 'IN'

export interface AddBatchData {
  item_id: string
  quantity: number
  unit: DisplayUnit
  unit_cost: number
  supplier_name: string
  received_date: string
  expired_date: string
  notes?: string
}

export interface InventoryBatch {
  id: string
  item_id: string
  batch_number: string
  quantity: number
  remaining_quantity: number
  cost_per_unit: number
  supplier_name: string
  received_date: string
  expired_date: string
  notes?: string
  created_at: string
}

// Generate batch number: CATEGORY-YYYYMMDD-HHMMSS
function generateBatchNumber(category: string): string {
  const now = new Date()
  const date = now.toISOString().split('T')[0].replace(/-/g, '')
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '')
  return `${category.toUpperCase()}-${date}-${time}`
}

export async function addBatch(data: AddBatchData, actorName: string = 'System'): Promise<InventoryBatch | null> {
  // Convert to base unit before saving
  const quantityInBaseUnit = toBaseUnit(data.quantity, data.unit)
  
  if (isSupabaseConfigured()) {
    // First get the item to get its category for batch number generation
    const item = await getInventoryItem(data.item_id)
    if (!item) {
      console.log("ERROR (addBatch): Item not found")
      return null
    }
    
    const batchNumber = generateBatchNumber(item.category)
    let finalBatch: InventoryBatch | null = null
    
    // Try RPC first: add_batch
    const { data: rpcResult, error: rpcError } = await supabase.rpc('add_batch', {
      p_item_id: data.item_id,
      p_quantity: quantityInBaseUnit,
      p_unit_cost: data.unit_cost,
      p_supplier_name: data.supplier_name,
      p_received_date: data.received_date,
      p_expired_date: data.expired_date,
      p_notes: data.notes || '',
      p_batch_number: batchNumber
    })
    
    if (!rpcError && rpcResult) {
      console.log("DATA (addBatch RPC):", rpcResult)
      finalBatch = rpcResult
    } else {
      console.log("RPC add_batch not found or failed, using direct inserts:", rpcError)
      
      // Fallback: Manual transaction
      // 1. INSERT into inventory_batches
      const { data: batchData, error: batchError } = await supabase
        .from('inventory_batches')
        .insert([{
          item_id: data.item_id,
          batch_number: batchNumber,
          quantity: quantityInBaseUnit,
          remaining_quantity: quantityInBaseUnit,
          cost_per_unit: data.unit_cost,
          supplier_name: data.supplier_name,
          received_date: data.received_date,
          expired_date: data.expired_date,
          notes: data.notes || ''
        }])
        .select()
        .single()
      
      if (batchError) {
        console.log("ERROR (addBatch insert):", batchError)
        return null
      }
      
      finalBatch = batchData
      
      // 2. UPDATE inventory_items: stock = stock + quantity
      const currentStock = item.stock || item.current_stock || 0
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ stock: currentStock + quantityInBaseUnit })
        .eq('id', data.item_id)
      
      if (updateError) {
        console.log("ERROR (addBatch update stock):", updateError)
      }
      
      // 3. INSERT into inventory_transactions: type = 'IN'
      const { error: txError } = await supabase
        .from('inventory_transactions')
        .insert([{
          item_id: data.item_id,
          type: 'in',
          quantity: quantityInBaseUnit,
          employee_id: null
        }])

      
      if (txError) {
        console.log("ERROR (addBatch transaction):", txError)
      }
    }

    if (finalBatch) {
      await logActivity(
        'inventory_change', 
        actorName, 
        data.item_id, 
        `Stock In: ${data.quantity} ${data.unit} added for ${item.name} (Batch: ${batchNumber})`
      )
    }
    
    return finalBatch
  }

  
  // Fallback for localStorage - simplified
  const inventory = await getInventory()
  const item = inventory.find(i => i.id === data.item_id)
  if (!item) return null
  
  const batchNumber = generateBatchNumber(item.category)
  const newBatch: InventoryBatch = {
    id: `batch-${Date.now()}`,
    item_id: data.item_id,
    batch_number: batchNumber,
    quantity: quantityInBaseUnit,
    remaining_quantity: quantityInBaseUnit,
    cost_per_unit: data.unit_cost,
    supplier_name: data.supplier_name,
    received_date: data.received_date,
    expired_date: data.expired_date,
    notes: data.notes,
    created_at: new Date().toISOString()
  }
  
  // Update stock locally
  const index = inventory.findIndex(i => i.id === data.item_id)
  if (index !== -1) {
    const newStock = (inventory[index].stock || inventory[index].current_stock || 0) + quantityInBaseUnit
    inventory[index] = { ...inventory[index], stock: newStock, current_stock: newStock }
    setStoredData(STORAGE_KEYS.inventory, inventory)
  }
  
  return newBatch
}

// ========== GET BATCHES ==========
// Get all batches for display in Batch Tracking page

export async function getBatches(): Promise<InventoryBatch[]> {
  if (isSupabaseConfigured()) {
    // Fetch batches
    const { data: batchesData, error: batchesError } = await supabase
      .from('inventory_batches')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (batchesError || !batchesData) {
      console.log("ERROR (getBatches):", batchesError)
      return []
    }
    
    // Fetch inventory items to join their names
    const { data: itemsData } = await supabase
      .from('inventory_items')
      .select('id, name, category, unit')
      
    // Join manually
    const itemMap = new Map()
    if (itemsData) {
      itemsData.forEach(item => itemMap.set(item.id, item))
    }
    
    const mapped = batchesData.map(batch => ({
      ...batch,
      inventory_items: itemMap.get(batch.item_id) || { name: 'Unknown' }
    }))
    
    return mapped
  }
  
  
  // Fallback - return empty for localStorage
  return []
}

// ========== PAYROLL ==========

export async function getPayrolls(startDate: string, endDate: string): Promise<PayrollRecord[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('payrolls')
      .select('*')
      .lte('start_date', endDate)
      .gte('end_date', startDate)
    
    if (error) {
      console.error("ERROR (getPayrolls):", error)
      return []
    }
    return data || []
  }
  return []
}

export async function upsertPayroll(payroll: PayrollRecord): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('payrolls')
      .upsert({
        ...payroll,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'employee_id,start_date,end_date'
      })
    
    if (error) {
      console.error("ERROR (upsertPayroll):", error.message, error.details, error.hint)
      return false
    }
    return true
  }
  return false
}

export async function settlePayrollBatch(startDate: string, endDate: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('payrolls')
      .update({ status: 'settled', updated_at: new Date().toISOString() })
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .eq('status', 'draft')
    
    if (error) {
      console.error("ERROR (settlePayrollBatch):", error)
      return false
    }
    return true
  }
  return false
}

export async function settlePayrollItems(employeeIds: string[], startDate: string, endDate: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('payrolls')
      .update({ status: 'settled', updated_at: new Date().toISOString() })
      .in('employee_id', employeeIds)
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .eq('status', 'draft')
    
    if (error) {
      console.error("ERROR (settlePayrollItems):", error)
      return false
    }
    return true
  }
  return false
}

export async function getEmployeePayrolls(employeeId: string): Promise<PayrollRecord[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('payrolls')
      .select('*')
      .eq('employee_id', employeeId)
      .order('end_date', { ascending: false })
    
    if (error) {
      console.error("ERROR (getEmployeePayrolls):", error)
      return []
    }
    return data || []
  }
  return []
}

// ========== GET BATCHES BY ITEM ==========
export async function getBatchesByItem(itemId: string): Promise<InventoryBatch[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('inventory_batches')
      .select('*')
      .eq('item_id', itemId)
      .order('expired_date', { ascending: true }) // FIFO by expiry
    
    if (error) {
      console.log("ERROR (getBatchesByItem):", error)
      return []
    }
    
    return data || []
  }
  
  return []
}

// ========== MONTHLY OPEX (OVERHEAD/BOP) ==========

export async function getMonthlyOpex(month?: string): Promise<MonthlyOpex[]> {
  if (isSupabaseConfigured()) {
    let query = supabase.from('monthly_opex').select('*')
    if (month) {
      query = query.eq('month', month)
    }
    const { data, error } = await query.order('created_at', { ascending: false })
    
    if (error) {
      console.error("ERROR (getMonthlyOpex):", error)
      return []
    }
    return data || []
  }
  return [] // Not supporting local fallback for Opex yet
}

export async function addMonthlyOpex(data: Omit<MonthlyOpex, 'id' | 'created_at'>): Promise<MonthlyOpex | null> {
  if (isSupabaseConfigured()) {
    const { data: result, error } = await supabase
      .from('monthly_opex')
      .insert([data])
      .select()
      .single()
    
    if (error) {
      console.error("ERROR (addMonthlyOpex):", error)
      return null
    }
    return result
  }
  return null
}

export async function deleteMonthlyOpex(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('monthly_opex')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error("ERROR (deleteMonthlyOpex):", error)
      return false
    }
    return true
  }
  return false
}

// ========== STOCK OPNAME (WEEKLY) ==========

export async function getInventoryOpnames(): Promise<InventoryOpname[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('inventory_opname')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error("ERROR (getInventoryOpnames):", error)
      return []
    }
    return data || []
  }
  return []
}

export async function addInventoryOpname(data: Omit<InventoryOpname, 'id' | 'created_at'>): Promise<InventoryOpname | null> {
  if (isSupabaseConfigured()) {
    // 1. Insert Opname Record
    const { data: result, error } = await supabase
      .from('inventory_opname')
      .insert([data])
      .select()
      .single()
    
    if (error) {
      console.error("ERROR (addInventoryOpname):", error)
      return null
    }

    // 2. Update Inventory Item Stock to match Actual Stock
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ stock: data.actual_stock, updated_at: new Date().toISOString() })
      .eq('id', data.item_id)

    if (updateError) {
      console.error("ERROR (updating stock on opname):", updateError)
    }

    // 3. Log as Waste in transactions if difference is negative (or just log the adjustment)
    if (data.difference !== 0) {
      const type = data.difference < 0 ? 'waste' : 'in'
      await supabase.from('inventory_transactions').insert([{
        item_id: data.item_id,
        type: type,
        quantity: Math.abs(data.difference),
        actor_name: data.actor_name,
        created_at: new Date().toISOString()
      }])
    }

    return result
  }
  return null
}

// ========== STORAGE (OPEX ATTACHMENTS) ==========

export async function uploadOpexAttachment(file: File): Promise<string | null> {
  if (isSupabaseConfigured()) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    const filePath = `${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('opex-attachments')
      .upload(filePath, file)

    if (uploadError) {
      console.error("ERROR (uploadOpexAttachment):", uploadError)
      return null
    }

    const { data } = supabase.storage
      .from('opex-attachments')
      .getPublicUrl(filePath)

    return data.publicUrl
  }
  return null
}
