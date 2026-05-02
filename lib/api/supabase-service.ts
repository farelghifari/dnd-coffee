import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { startOfMonth, endOfMonth } from "date-fns"
import type { InventoryItem, InventoryBatch, BatchStatus } from '@/lib/data'
export type { InventoryItem, InventoryBatch, BatchStatus }

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

import { getLocalYYYYMMDD, isShiftLocked, isPastDate } from '@/lib/utils'

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
  systemLogs: "dnd_system_logs",
  outlets: "dnd_outlets"
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
export type BaseUnit = 'gram' | 'ml' | 'pcs' | 'kg' | 'liter'

export const UNIT_CONVERSIONS: Record<DisplayUnit, { baseUnit: BaseUnit; multiplier: number }> = {
  kg: { baseUnit: 'gram', multiplier: 1000 },
  gram: { baseUnit: 'gram', multiplier: 1 },
  liter: { baseUnit: 'ml', multiplier: 1000 },
  ml: { baseUnit: 'ml', multiplier: 1 },
  pcs: { baseUnit: 'pcs', multiplier: 1 }
}

/**
 * Returns the conversion multiplier from a display unit to a base unit.
 * Example: 'liter' to 'ml' returns 1000.
 */
export function getConversionRate(displayUnit: string, baseUnit: string): number {
  const d = displayUnit.toLowerCase();
  const b = baseUnit.toLowerCase();
  
  if (d === b) return 1;
  
  // Weights
  if ((d === 'kg' && b === 'gram') || (d === 'kilogram' && b === 'gram')) return 1000;
  if (d === 'gram' && b === 'kg') return 0.001;
  
  // Volumes
  if ((d === 'liter' && b === 'ml') || (d === 'l' && b === 'ml')) return 1000;
  if (d === 'ml' && b === 'liter') return 0.001;
  
  return 1;
}


// Convert display unit to base unit
export function toBaseUnit(value: number, unit: string, item?: Partial<InventoryItem>): number {
  const normalizedUnit = unit.toLowerCase()
  const conversion = UNIT_CONVERSIONS[normalizedUnit as DisplayUnit]
  
  if (conversion) {
    return value * conversion.multiplier
  }
  
  // If it's a custom unit (like 'batch') and matches the item's display unit
  if (item && item.display_unit && normalizedUnit === item.display_unit.toLowerCase()) {
    return value * (item.conversion_rate || 1)
  }
  
  return value
}

// Convert base unit to display unit
export function fromBaseUnit(value: number, unit: string, item?: Partial<InventoryItem>): number {
  const normalizedUnit = unit.toLowerCase()
  const conversion = UNIT_CONVERSIONS[normalizedUnit as DisplayUnit]
  
  if (conversion) {
    return value / conversion.multiplier
  }
  
  // If it's a custom unit (like 'batch') and matches the item's display unit
  if (item && item.display_unit && normalizedUnit === item.display_unit.toLowerCase()) {
    return value / (item.conversion_rate || 1)
  }
  
  return value
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
    return ['gram', 'kg', 'ml', 'liter'] as DisplayUnit[]
  }
  
  // Custom or Piece units - return the unit itself as the allowed option
  // This covers 'pcs', 'batch', 'loyang', 'box', 'botol', etc.
  return [inventoryUnit] as DisplayUnit[]
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

// Global utility for formatting inventory item stock values based on display config
export function getDisplayUnit(item: Partial<InventoryItem>): DisplayUnit {
  return (item.display_unit || getDefaultDisplayUnit(item.unit || 'pcs') || item.unit || 'pcs') as DisplayUnit;
}

export function getDisplayStock(amount: number, item: Partial<InventoryItem>): number {
  if (amount === undefined || amount === null) return 0;
  
  const dUnit = getDisplayUnit(item);
  let multiplier = item.conversion_rate || 1;
  
  if (multiplier === 1 && dUnit.toLowerCase() !== (item.unit || '').toLowerCase()) {
    multiplier = getConversionRate(dUnit, item.unit || 'pcs') || 1;
  }
  
  // Only apply division/conversion if unit requires it
  const converted = amount / multiplier;
  
  // Avoid long decimals (max 4 decimal places)
  return parseFloat(converted.toFixed(4));
}

export function resolveDisplayStockToDb(displayAmount: number, item: Partial<InventoryItem>): number {
  if (displayAmount === undefined || displayAmount === null) return 0;
  
  const dUnit = getDisplayUnit(item);
  let multiplier = item.conversion_rate || 1;
  
  if (multiplier === 1 && dUnit.toLowerCase() !== (item.unit || '').toLowerCase()) {
    multiplier = getConversionRate(dUnit, item.unit || 'pcs') || 1;
  }
  
  return displayAmount * multiplier;
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
  status: "active" | "inactive" | "deleted"
  super_admin_expires_at?: string | null // Timestamp for temporary super_admin expiration
  phone_number?: string | null
  avatar_url?: string | null
  contract_pdf_url?: string | null
  registered_device?: string | null
  last_device_id?: string | null
  contract_start_date?: string | null
  contract_end_date?: string | null
  // For local/fallback compatibility
  nickname?: string
  avatar?: string
  created_at?: string
}

export interface EmployeeContract {
  id: string
  employee_id: string
  start_date: string
  end_date: string
  contract_pdf_url: string | null
  created_at: string
}

// DB Schema: inventory_items(id, name, category, unit, stock)
export interface DBInventoryItem {
  id: string
  name: string
  category: string
  unit: string
  stock: number
  min_stock?: number
  max_stock?: number
  daily_usage?: number
  unit_cost?: number
  display_unit?: string
  conversion_rate?: number
  expiry_date?: string
  supplier_name?: string
  notes?: string
}

// DB Schema: inventory_transactions(id, item_id, employee_id, type, quantity)
export interface InventoryTransaction {
  id: string
  item_id: string
  employee_id: string | null
  type: "in" | "out" | "waste" | "opname"
  quantity: number
  waste_reason?: string | null
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
  unit?: string
  type: "in" | "out" | "waste" | "opname"
  amount: number
  employee_id?: string | null
  employee_name?: string
  timestamp: string
  notes?: string
}

export interface Outlet {
  id: string
  name: string
  latitude: number
  longitude: number
  radius_meters: number
  is_active: boolean
  image_url?: string | null
  created_at?: string
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
  // New metadata
  method?: 'personal' | 'nfc' | 'manual'
  device_info?: string
  latitude?: number
  longitude?: number
  ip_address?: string
  outlet_id?: string
  is_ops_device?: boolean
  // For local/fallback compatibility
  employee_name?: string
  type?: "clock-in" | "clock-out"
}

export interface EmployeeKPI {
  id: string
  employee_id: string
  points: number
  category: string
  notes?: string
  date: string
  created_by: string
  created_at: string
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
  attendance_log_id?: string | null
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
  approved_overtime_minutes?: number
  is_scheduled?: boolean
}

// System Activity Log - tracks all system changes
export interface SystemLog {
  id: string
  action: "inventory_change" | "employee_update" | "role_change" | "settings_change" | "shift_change" | "overtime_action" | "contract_renewal" | "kpi_change" | "employee_delete" | "menu_change"
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
      .neq('status', 'deleted')
      .order('name', { ascending: true })
    
    console.log("DATA (getEmployees):", data)
    console.log("ERROR (getEmployees):", error)
    
    if (error) {
      return []
    }
    return data || []
  }
  
  return getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
    .filter(e => e.status !== 'deleted')
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
      .neq('status', 'deleted')
      .single()
    
    console.log("DATA (getEmployeeByEmail):", data)
    console.log("ERROR (getEmployeeByEmail):", error)
    
    if (error) {
      return null
    }
    return data
  }
  
  const employees = getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
  return employees.find(e => e.email === email && e.status !== 'deleted') || null
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
      .neq('status', 'deleted')
      .single()
    
    console.log("DATA (getEmployeeByNFC exact):", data)
    if (error) console.log("ERROR (getEmployeeByNFC exact):", error)
    
    // If no exact match found, or if error, try case-insensitive ilike
    if (!data) {
      console.log("NO EXACT MATCH, trying ilike for:", cleanUID)
      const { data: ilikeData, error: ilikeError } = await supabase
        .from('employees')
        .select('*')
        .ilike('nfc_uid', cleanUID)
        .neq('status', 'deleted')
        .maybeSingle() // Use maybeSingle to avoid 406 on multiples (UIDs should be unique)
      
      data = ilikeData
      error = ilikeError
      
      console.log("DATA (getEmployeeByNFC ilike):", data)
      if (ilikeError) console.log("ERROR (getEmployeeByNFC ilike):", ilikeError)
    }
    
    return data || null
  }
  
  // Fallback - use case-insensitive match
  const employees = getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
  return employees.find(e => 
    e.nfc_uid?.toLowerCase() === cleanUID.toLowerCase() && e.status !== 'deleted'
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
    if (updates.phone_number !== undefined) dbUpdates.phone_number = updates.phone_number
    if (updates.avatar_url !== undefined) dbUpdates.avatar_url = updates.avatar_url
    if (updates.contract_pdf_url !== undefined) dbUpdates.contract_pdf_url = updates.contract_pdf_url
    if (updates.contract_start_date !== undefined) dbUpdates.contract_start_date = updates.contract_start_date
    if (updates.contract_end_date !== undefined) dbUpdates.contract_end_date = updates.contract_end_date
    if (updates.registered_device !== undefined) dbUpdates.registered_device = updates.registered_device
    if (updates.last_device_id !== undefined) dbUpdates.last_device_id = updates.last_device_id
    
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
      .neq('status', 'deleted')
      .order('name', { ascending: true })
    
    console.log("DATA (getAdmins):", data)
    console.log("ERROR (getAdmins):", error)
    
    if (error) {
      return []
    }
    return data || []
  }
  
  const employees = getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
  return employees.filter(e => e.role === 'admin' && e.status !== 'deleted')
}

export async function deleteEmployee(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('employees')
      .update({ 
        status: 'deleted',
        nfc_uid: null // Free up NFC UID for reuse if it was assigned
      })
      .eq('id', id)
    
    console.log("ERROR (deleteEmployee - Soft Delete):", error)
    
    if (error) {
      return false
    }
    return true
  }
  
  const employees = getStoredData(STORAGE_KEYS.employees, mockEmployees as Employee[])
  const index = employees.findIndex(e => e.id === id)
  if (index === -1) return false
  
  employees[index] = { 
    ...employees[index], 
    status: 'deleted',
    nfc_uid: null 
  }
  setStoredData(STORAGE_KEYS.employees, employees)
  return true
}

// ========== EMPLOYEE CONTRACTS & RENEWAL ==========

export async function getEmployeeContractHistory(employeeId: string): Promise<EmployeeContract[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('employee_contracts')
      .select('*')
      .eq('employee_id', employeeId)
      .order('end_date', { ascending: false })
    
    if (error) {
      console.log("ERROR (getEmployeeContractHistory):", error)
      return []
    }
    return data || []
  }
  return [] // Not implemented for localStorage
}

export async function renewEmployeeContract(
  employeeId: string, 
  newContract: { start_date: string; end_date: string; pdf_url: string | null },
  actorName: string = 'System'
): Promise<boolean> {
  if (isSupabaseConfigured()) {
    // 1. Call the database RPC function to handle the renewal atomically
    // This function handles archiving old contract and updating with new one
    const { data: success, error: rpcError } = await supabase.rpc('renew_employee_contract', {
      p_employee_id: employeeId,
      p_new_start_date: newContract.start_date,
      p_new_end_date: newContract.end_date,
      p_new_pdf_url: newContract.pdf_url
    })
    
    if (rpcError || !success) {
      console.log("ERROR (renewEmployeeContract RPC):", rpcError)
      return false
    }

    // 2. Log the renewal activity (Still handled in frontend/log table)
    const employee = await getEmployeeById(employeeId)
    if (employee) {
      await logActivity(
        'contract_renewal',
        actorName,
        employee.name,
        `Renewed contract until ${newContract.end_date}`
      )
    }

    return true
  }
  
  // Local storage fallback (partial)
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
    const { data: items, error: itemsError } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name', { ascending: true })
    
    if (itemsError) {
      console.error("ERROR (getInventory items):", itemsError)
      return []
    }

    // Fetch warehouse batches to guarantee perfectly accurate stock
    const { data: batches, error: batchesError } = await supabase
      .from('inventory_batches')
      .select('item_id, remaining_quantity')
      .eq('location', 'warehouse');

    if (batchesError) {
      console.error("ERROR (getInventory batches):", batchesError)
    }

    // Map database fields to application fields carefully
    return (items || []).map((row: any) => {
      // Calculate true warehouse stock from batches
      const itemBatches = (batches || []).filter(b => b.item_id === row.id);
      const batchTotal = itemBatches.reduce((sum, b) => sum + (Number(b.remaining_quantity) || 0), 0);
      
      // Source of truth: use batchTotal if batches were successfully fetched, otherwise fallback to row.stock
      const finalStock = (batches && !batchesError) ? batchTotal : (row.stock ?? 0);

      return {
        id: row.id,
        name: row.name,
        category: row.category,
        unit: row.unit || 'pcs',
        displayUnit: row.display_unit || row.unit || 'pcs',
        currentStock: finalStock,
        stock: finalStock,
        current_stock: finalStock,
        minStock: row.min_stock ?? 10,
        min_stock: row.min_stock ?? 10,
        maxStock: row.max_stock ?? 100,
        max_stock: row.max_stock ?? 100,
        dailyUsage: row.daily_usage ?? 0,
        daily_usage: row.daily_usage ?? 0,
        unitCost: row.unit_cost ?? 0,
        unit_cost: row.unit_cost ?? 0,
        lastUpdated: row.last_updated || row.updated_at || new Date().toISOString(),
        last_updated: row.last_updated || row.updated_at || new Date().toISOString(),
        conversionRate: row.conversion_rate ?? 1,
        conversion_rate: row.conversion_rate ?? 1,
        display_unit: row.display_unit || row.unit || 'pcs',
        expiryDate: row.expiry_date,
        expiry_date: row.expiry_date,
        status: row.status || 'active'
      }
    })
  }
  
  const stored = getStoredData(STORAGE_KEYS.inventory, mockInventory)
  return (stored as any[]).map(item => ({
    ...item,
    currentStock: item.currentStock ?? item.stock ?? 0,
    stock: item.stock ?? item.currentStock ?? 0,
    current_stock: item.currentStock ?? item.stock ?? 0,
    minStock: item.minStock ?? 10,
    maxStock: item.maxStock ?? 100,
    dailyUsage: item.dailyUsage ?? 0,
    unitCost: item.unitCost ?? 0,
    displayUnit: item.displayUnit || item.unit || 'pcs',
    display_unit: item.displayUnit || item.unit || 'pcs',
    lastUpdated: item.lastUpdated || new Date().toISOString()
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

export async function updateInventoryStock(itemId: string, quantity: number, type: "in" | "out" | "waste" | "opname", employeeId: string | null, actorName: string = 'System', notes?: string) {
  if (!isSupabaseConfigured()) return null;

  try {
    const item = await getInventoryItem(itemId);
    if (!item) return null;

    if (type === 'in') {
      // Fetch most recent cost for this item
      const { data: lastBatch } = await supabase
        .from('inventory_batches')
        .select('cost_per_unit')
        .eq('item_id', itemId)
        .order('received_date', { ascending: false })
        .limit(1);
      
      const lastCost = (lastBatch && lastBatch.length > 0) ? lastBatch[0].cost_per_unit : 0;

      // Create a default batch for Ops Stock In
      const result = await addBatch({
        item_id: itemId,
        quantity: quantity,
        unit: item.unit as any,
        unit_cost: lastCost,
        supplier_name: 'Unknown',
        received_date: new Date().toISOString().split('T')[0],
        expired_date: null,
        notes: notes || `Input via Ops Device by ${actorName}. Price auto-filled (Rp ${lastCost})`,
        is_opened: false
      }, actorName);
      
      if (!result) {
        throw new Error("Database rejected the stock entry. Please try again.");
      }

      return result;
    } else if (type === 'out' || type === 'waste') {
      let remainingToDeduct = quantity;
      const { data: batches } = await supabase
        .from('inventory_batches')
        .select('*')
        .eq('item_id', itemId)
        .eq('location', 'warehouse')
        .gt('remaining_quantity', 0)
        .order('received_date', { ascending: true })
        .order('batch_number', { ascending: true });

      for (const batch of batches || []) {
        if (remainingToDeduct <= 0) break;
        const available = Number(batch.remaining_quantity);
        const amountFromThisBatch = Math.min(available, remainingToDeduct);
        
        if (type === 'out') {
          // Use specialized transfer function to ensure it appears in Batch Tracking (Floor)
          // We use conversion_rate as split_size to create multiple rows if multiple units are moved
          await transferToFloor(
            batch.id, 
            amountFromThisBatch, 
            actorName, 
            notes || `Ops Stock Out by ${actorName}`, 
            item.conversion_rate || 1
          );
        } else {
          // Waste: Simple deduction from warehouse
          if (available >= amountFromThisBatch) {
            await supabase.from('inventory_batches').update({ remaining_quantity: available - amountFromThisBatch }).eq('id', batch.id);
          } else {
            await supabase.from('inventory_batches').update({ remaining_quantity: 0 }).eq('id', batch.id);
          }
          
          // Also decrement the master stock column for consistency
          await supabase.rpc('decrement_inventory_stock', { p_item_id: itemId, p_quantity: amountFromThisBatch });

          // Record individual transaction log for this batch to keep the batch info visible
          if (type === 'waste') {
            await supabase.from('inventory_transactions').insert({
              item_id: itemId,
              type: type,
              quantity: amountFromThisBatch,
              actor_name: actorName,
              waste_reason: notes ? `${notes} (Batch: ${batch.batch_number})` : `Recorded via Ops (Batch: ${batch.batch_number})`,
              created_at: new Date().toISOString()
            });
          }
        }
        
        remainingToDeduct -= amountFromThisBatch;
      }
    } else if (type === 'opname') {
      const theoretical = await getInventory().then(items => items.find(i => i.id === itemId)?.stock || 0);
      return await addInventoryOpname({
        item_id: itemId,
        theoretical_stock: theoretical,
        actual_stock: quantity,
        difference: quantity - theoretical,
        reason: notes || `Ops Opname by ${actorName}`,
        actor_name: actorName
      });
    }

    // Update master stock for legacy (only reached for 'out' or 'waste' types)
    const currentStock = item.stock || 0;
    const newStock = Math.max(0, currentStock - quantity);
    await supabase.from('inventory_items').update({ stock: newStock }).eq('id', itemId);

    return { success: true };
  } catch (err) {
    console.error("CRITICAL ERROR (updateInventoryStock):", err);
    return null;
  }
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
  display_unit?: string
  conversion_rate?: number
  supplier_name?: string
  notes?: string
  received_date?: string
  expiry_date?: string
}

export async function upsertInventory(data: UpsertInventoryData, actorName: string = 'System'): Promise<InventoryItem | null> {
  const isUpdate = !!data.id
  let resultItem: InventoryItem | null = null
  
  // SANITIZE: Convert empty strings to null for database compatibility
  const sanitizedExpiry = data.expiry_date && data.expiry_date.trim() !== "" ? data.expiry_date : null;

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
      p_unit_cost: data.unit_cost || 0,
      p_expiry_date: sanitizedExpiry,
      p_display_unit: data.display_unit || null,
      p_conversion_rate: data.conversion_rate || 1
    })
    
    if (error) {
      // RPC failed (likely parameter mismatch or legacy function). Try direct update/insert.
      const baseUpdate: Record<string, any> = {
        name: data.name,
        category: data.category,
        unit: data.unit,
        stock: data.stock,
        min_stock: data.min_stock,
        max_stock: data.max_stock,
        daily_usage: data.daily_usage,
        unit_cost: data.unit_cost,
        supplier_name: data.supplier_name,
        notes: data.notes,
        expiry_date: sanitizedExpiry
      }
      
      const extendedUpdate = {
        ...baseUpdate,
        display_unit: data.display_unit,
        conversion_rate: data.conversion_rate
      }
      
      if (data.id) {
        // Try update with all columns first
        let { data: updated, error: uError } = await supabase
          .from('inventory_items')
          .update(extendedUpdate)
          .eq('id', data.id)
          .select()
          .single()
        
        // If it fails due to missing columns, retry with only base columns
        if (uError && (uError.message?.includes('column') || uError.code === '42703')) {
          const retry = await supabase
            .from('inventory_items')
            .update(baseUpdate)
            .eq('id', data.id)
            .select()
            .single()
          updated = retry.data
          uError = retry.error
        }
        
        if (uError) {
          console.error("UPSERT FALLBACK ERROR:", uError.message || uError)
        }
        resultItem = updated ? { ...updated, current_stock: updated.stock } : (data.id ? { ...data, stock: data.stock, current_stock: data.stock } : null) as any
      } else {
        // Try insert with all columns first
        let { data: inserted, error: iError } = await supabase
          .from('inventory_items')
          .insert([extendedUpdate])
          .select()
          .single()
        
        if (iError && (iError.message?.includes('column') || iError.code === '42703')) {
          const retry = await supabase
            .from('inventory_items')
            .insert([baseUpdate])
            .select()
            .single()
          inserted = retry.data
          iError = retry.error
        }
        
        if (iError) console.error("INSERT FALLBACK ERROR:", iError.message || iError)
        resultItem = inserted ? { ...inserted, current_stock: inserted.stock } : null
      }
    } else {
      // RPC succeeded. Now optionally patch the columns that RPC might have missed
      const targetId = result?.id || data.id
      
      if (targetId && (data.display_unit || data.conversion_rate)) {
        await supabase
          .from('inventory_items')
          .update({
            display_unit: data.display_unit,
            conversion_rate: data.conversion_rate || 1
          })
          .eq('id', targetId)
      }
      
      if (targetId) {
        resultItem = await getInventoryItem(targetId)
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
    
    await logActivity('inventory_change', actorName, resultItem.name, detail)
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
export async function saveMenuRecipes(menuItemId: string, ingredients: MenuRecipeIngredient[], actorName: string = 'Admin'): Promise<boolean> {
  if (isSupabaseConfigured()) {
    // STEP 1: Delete existing recipes for this menu item
    const { error: deleteError } = await supabase
      .from('menu_recipes')
      .delete()
      .eq('menu_item_id', menuItemId)
    
    if (deleteError) {
      console.error("ERROR (saveMenuRecipes delete):", deleteError.message)
    }
    
    // STEP 2: Prepare and Insert new recipes
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
        console.error("ERROR (saveMenuRecipes insert):", insertError.message, insertError.details)
        return false
      }

      // Get menu item name for better logging
      const menu = await getMenuItemById(menuItemId)
      if (menu) {
        await logActivity(
          'menu_change',
          actorName,
          menu.name,
          `Recipes Updated for ${menu.name} (${ingredients.length} ingredients)`
        )
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
  total_cost?: number // COGS
  employee_id?: string // Barista
  created_at: string
}


export interface MonthlyTarget {
  id: string
  month: string
  revenue_target: number
  sales_target: number
  aov_target: number
  growth_percentage: number
  is_automatic: boolean
  updated_at?: string
}

export interface FinancialSummary {
  revenue: number
  cogs: number
  grossProfit: number
  opex: number
  waste: number
  payroll: number
  netProfit: number
  totalTransactions: number
  aov: number
  salesPerHour: Record<string, number>
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
      
      // Fallback: fetch without join, then manually map names
      const { data: rawData, error: rawError } = await supabase
        .from('sales_logs')
        .select('id, menu_id, quantity, total_price, created_at')
        .order('created_at', { ascending: false })
      
      console.log("[DEBUG getSalesLogs FALLBACK] rawData length:", rawData?.length, "rawError:", rawError)
      
      if (rawError || !rawData) return []
      
      // Fetch menu names manually
      const { data: menuItems } = await supabase.from('menu_items').select('id, name')
      const nameMap = new Map((menuItems || []).map((m: any) => [m.id, m.name]))
      
      return rawData.map((log: any) => ({
        id: log.id,
        menu_id: log.menu_id,
        menu_name: nameMap.get(log.menu_id) || 'Unknown',
        quantity: log.quantity,
        total_price: log.total_price,
        created_at: log.created_at
      }))
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

export async function getSalesReport(month?: string): Promise<SalesReport[]> {
  if (isSupabaseConfigured()) {
    let query = supabase.from('sales_logs').select(`
      menu_id,
      quantity,
      total_price,
      created_at,
      menu_items(name)
    `)

    if (month) {
      const start = startOfMonth(new Date(month + "-01"))
      const end = endOfMonth(new Date(month + "-01"))
      query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
    }

    let { data, error } = await query
    
    // If foreign key relation isn't mapped, fallback to manual join
    if (error) {
      console.log("Fallback fetching sales_logs due to:", error.message)
      const { data: rawData, error: rawError } = await supabase
        .from('sales_logs')
        .select(`menu_id, quantity, total_price`)
      
      if (rawError) return []
      
      // Fetch names manually
      const { data: menuItems } = await supabase.from('menu_items').select('id, name')
      const nameMap = new Map((menuItems || []).map((m: any) => [m.id, m.name]))
      
      data = (rawData || []).map((row: any) => ({
        ...row,
        menu_items: { name: nameMap.get(row.menu_id) || 'Unknown' }
      }))
    }
    
    // Aggregate by menu_id
    const reportMap = new Map<string, SalesReport>()
    
    for (const log of data || []) {
      const menuId = log.menu_id || 'unknown-menu'
      // Account for both array response or object response based on Supabase relation setup
      const itemsData = log.menu_items
      let menuName = 'Unknown'
      
      if (Array.isArray(itemsData) && itemsData.length > 0) {
        menuName = itemsData[0].name
      } else if (itemsData && typeof itemsData === 'object' && !Array.isArray(itemsData)) {
        menuName = (itemsData as unknown as { name: string }).name
      }
      
      if (reportMap.has(menuId)) {
        const existing = reportMap.get(menuId)!
        existing.total_sold += log.quantity || 0
        existing.revenue += log.total_price || 0
      } else {
        reportMap.set(menuId, {
          menu_id: menuId,
          menu_name: menuName,
          total_sold: log.quantity || 0,
          revenue: log.total_price || 0
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

export function subscribeToInventoryBatches(callback: (payload?: RealtimePayload) => void) {
  if (!isSupabaseConfigured()) return () => {}
  
  const channel = supabase
    .channel('inventory_batches_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inventory_batches' },
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
        actor_name,
        created_at,
        inventory_items(name, unit, display_unit, conversion_rate),
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
    return (data || []).map(t => {
      const item = t.inventory_items as any
      const multiplier = item?.conversion_rate || 1
      const displayAmount = parseFloat((t.quantity / multiplier).toFixed(4))
      const displayUnit = item?.display_unit || item?.unit || ''
      
      return {
        id: t.id,
        item_id: t.item_id,
        item_name: item?.name || 'Unknown Item',
        unit: displayUnit,
        type: t.type,
        amount: displayAmount,
        employee_id: t.employee_id,
        employee_name: (t.employees as any)?.name || t.actor_name || 'Unknown User',
        timestamp: t.created_at,
        notes: '' // notes aren't in transactions table yet
      }
    })
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
    log.employee_name || 'System',
    log.notes
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
    date: log.timestamp?.split('T')[0] || getLocalYYYYMMDD(),
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
// ATTENDANCE FIX - Clock In/Out must insert: employee_id, employee_name, date (today), time (now), action, status
export async function addAttendanceLog(log: { 
  employee_id: string; 
  employee_name?: string; 
  type: "clock-in" | "clock-out"; 
  manual_date?: string; 
  manual_time?: string;
  method?: 'personal' | 'nfc';
  device_info?: string;
  latitude?: number;
  longitude?: number;
  ip_address?: string;
  outlet_id?: string;
  is_ops_device?: boolean;
}): Promise<AttendanceLog | null> {
  const now = new Date()
  const date = log.manual_date || getLocalYYYYMMDD(now)
  const time = log.manual_time || now.toTimeString().split(' ')[0]
  
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .insert([{
        employee_id: log.employee_id,
        employee_name: log.employee_name,
        date: date,
        time: time,
        action: log.type,
        status: 'present',
        method: log.method || 'nfc',
        device_info: log.device_info,
        latitude: log.latitude,
        longitude: log.longitude,
        ip_address: log.ip_address,
        outlet_id: log.outlet_id,
        is_ops_device: log.is_ops_device || false
      }])
      .select()
      .single()
    
    console.log("DATA (addAttendanceLog):", data)
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
    timestamp: `${date}T${time}`,
    method: log.method || 'nfc',
    device_info: log.device_info,
    latitude: log.latitude,
    longitude: log.longitude,
    ip_address: log.ip_address,
    outlet_id: log.outlet_id,
    is_ops_device: log.is_ops_device || false
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
  const otRequests = await getOvertimeRequestsByEmployee(employeeId)
  const otMap = new Map(otRequests.map(r => [r.attendance_log_id, r]))
  
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
      const otReq = otMap.get(currentInLog.id)
      const os = otReq?.status || currentInLog.status || 'none'
      const sessionData = calculateRegulatedSession(currentInLog, log, dayShift, os, otReq?.approved_overtime_minutes)
      sessions.push(sessionData)
      currentInLog = null
    }
  }

  // If still clocked in (no clock-out yet), calculate running duration
  if (currentInLog) {
    const otReq = otMap.get(currentInLog.id)
    const os = otReq?.status || currentInLog.status || 'none'
    const sessionData = calculateRegulatedSession(currentInLog, null, dayShift, os, otReq?.approved_overtime_minutes)
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
  otStatus: string = "none",
  approvedOtMins: number = 0,
  allDayOts: OvertimeRequest[] = []
) {
  const clockIn = clockInLog.timestamp
  let clockOut = clockOutLog?.timestamp || null
  
  let effectiveOtStatus = otStatus
  if (effectiveOtStatus === 'none' && (clockInLog.status === 'approved' || clockInLog.status === 'rejected')) {
    effectiveOtStatus = clockInLog.status
  }
  
  const cIn = new Date(clockIn)
  let cOut = clockOut ? new Date(clockOut) : new Date()
  let isAutoClockOut = false

  let shiftStart: Date | null = null
  let shiftEnd: Date | null = null

  if (shift) {
    shiftStart = new Date(`${shift.date}T${shift.start_time}`)
    shiftEnd = new Date(`${shift.date}T${shift.end_time}`)
    if (shift.end_time <= shift.start_time) {
      shiftEnd.setDate(shiftEnd.getDate() + 1)
    }
  }

  let maxEnd: Date | null = null
  if (shift && shiftEnd) {
    maxEnd = new Date(shiftEnd.getTime() + 15 * 60000)
    if (effectiveOtStatus === 'approved' && approvedOtMins > 0) {
      const otEnd = new Date(Math.max(cIn.getTime(), shiftEnd.getTime()) + approvedOtMins * 60000)
      if (otEnd > maxEnd) maxEnd = otEnd
    }
  } else if (effectiveOtStatus === 'approved' && approvedOtMins > 0) {
    maxEnd = new Date(cIn.getTime() + approvedOtMins * 60000)
  } else {
    maxEnd = new Date(cIn.getTime() + 8 * 60 * 60000)
  }

  if (maxEnd && cOut > maxEnd) {
    cOut = maxEnd
    isAutoClockOut = true
    clockOut = cOut.toISOString()
  }
  
  const totalMins = Math.max(0, Math.round((cOut.getTime() - cIn.getTime()) / 60000))
  
  let regMins = 0
  let otMins = 0
  let isLate = false
  let lateMinutes = 0
  let isPenalty = false

  const isManualOverride = clockInLog.method === 'manual' || clockInLog.device_info === 'Admin Override'

  if (isManualOverride) {
    regMins = totalMins
    otMins = 0
  } else if (shift && shiftStart && shiftEnd) {
    const delay = Math.round((cIn.getTime() - shiftStart.getTime()) / 60000)
    if (delay > 0) {
      isLate = true
      lateMinutes = delay
      if (delay > 15) isPenalty = true
    }

    const effectiveStartForReg = new Date(Math.max(cIn.getTime(), shiftStart.getTime()))
    const effectiveEndForReg = new Date(Math.min(cOut.getTime(), shiftEnd.getTime()))
    
    if (effectiveEndForReg > effectiveStartForReg) {
      regMins = Math.round((effectiveEndForReg.getTime() - effectiveStartForReg.getTime()) / 60000)
      regMins = Math.min(regMins, 480)
    }

    const preShiftStart = cIn
    const preShiftEnd = new Date(Math.min(cOut.getTime(), shiftStart.getTime()))
    if (preShiftEnd > preShiftStart) {
      const preMins = Math.round((preShiftEnd.getTime() - preShiftStart.getTime()) / 60000)
      if (effectiveOtStatus === 'approved') otMins += preMins
    }

    const postShiftStart = new Date(Math.max(cIn.getTime(), shiftEnd.getTime()))
    const postShiftEnd = cOut
    if (postShiftEnd > postShiftStart) {
      const postMins = Math.round((postShiftEnd.getTime() - postShiftStart.getTime()) / 60000)
      if (effectiveOtStatus === 'approved') otMins += postMins
    }
  } else {
    if (effectiveOtStatus === 'approved') otMins = totalMins
  }

  return {
    clockIn,
    clockOut,
    minutes: totalMins,
    regularMinutes: regMins,
    overtimeMinutes: otMins,
    isLate,
    lateMinutes,
    isPenalty,
    isAutoClockOut,
    otStatus: effectiveOtStatus,
    shift: shift,
    method: clockInLog?.method || clockOutLog?.method,
    deviceInfo: clockInLog?.device_info || clockOutLog?.device_info,
    ipAddress: clockInLog?.ip_address || clockOutLog?.ip_address,
    outletId: clockInLog?.outlet_id || clockOutLog?.outlet_id
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
      employee_id: log.employee_id,
      employee_name: log.employee_name || 'Unknown',
      type: log.action || log.type || 'clock-in', // Default to clock-in if missing
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
  const shiftsMap = new Map<string, ShiftAssignment[]>()
  for (const shift of allShifts) {
    const key = `${shift.employee_id}_${shift.date}`
    if (!shiftsMap.has(key)) shiftsMap.set(key, [])
    shiftsMap.get(key)!.push(shift)
  }

  // Group OT Requests by employee_id and date for broader lookup
  const otMap = new Map<string, OvertimeRequest[]>()
  for (const ot of allOT) {
    const key = `${ot.employee_id}_${ot.request_date}`
    if (!otMap.has(key)) otMap.set(key, [])
    otMap.get(key)!.push(ot)
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
      const empDayShifts = shiftsMap.get(key) || []
      
      const claimedShiftIds = new Set<string>()

      if (empDayLogs.length > 0) {
        // Calculate duration logic fully in-memory
        const dailySessions: any[] = []
        let currentInLog: AttendanceLog | null = null

        const sortedLogs = [...empDayLogs].sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )

        const processSession = (inLog: AttendanceLog, outLog: AttendanceLog | null) => {
          // Find best matching shift for this session
          const iDate = new Date(inLog.timestamp)
          let bestShift: ShiftAssignment | undefined
          let minDiff = Infinity

          for (const s of empDayShifts) {
            // Robust matching: Create a shift date in the same context as the clock-in log
            const sStart = new Date(iDate)
            const [h, m] = s.start_time.split(':').map(Number)
            sStart.setHours(h, m, 0, 0)
            
            let diff = Math.abs(iDate.getTime() - sStart.getTime())
            
            // Handle shifts that might be across midnight (distance to previous/next day's same-time shift)
            if (diff > 12 * 60 * 60 * 1000) {
              const diffPrev = Math.abs(iDate.getTime() - (sStart.getTime() - 24 * 60 * 60 * 1000))
              const diffNext = Math.abs(iDate.getTime() - (sStart.getTime() + 24 * 60 * 60 * 1000))
              if (diffPrev < diff) diff = diffPrev
              if (diffNext < diff) diff = diffNext
            }

            if (diff < minDiff) {
              minDiff = diff
              bestShift = s
            }
          }

          // Only "claim" the shift if the match is within a reasonable window (e.g. 12 hours)
          // or if it's the only shift available
          if (bestShift && (minDiff < 12 * 60 * 60 * 1000 || empDayShifts.length === 1)) {
            claimedShiftIds.add(bestShift.id)
          } else {
            bestShift = undefined // Treat as unscheduled
          }

          const dayOts = otMap.get(key) || []
          const specificOt = dayOts.find(o => o.attendance_log_id === inLog.id)
          const os = inLog.status === 'rejected' ? 'rejected' : (specificOt?.status || inLog.status || 'none')
          
          return calculateRegulatedSession(
            inLog, 
            outLog, 
            bestShift, 
            os, 
            specificOt?.approved_overtime_minutes, 
            dayOts
          )
        }

        for (const log of sortedLogs) {
          const action = (log.action || log.type || '').toLowerCase()
          
          if (action.includes('in')) {
            if (currentInLog) {
              dailySessions.push(processSession(currentInLog, null))
            }
            currentInLog = log
          } else if (action.includes('out')) {
            dailySessions.push(processSession(currentInLog || log, currentInLog ? log : null))
            currentInLog = null
          } else {
            dailySessions.push(processSession(log, null))
          }
        }

        if (currentInLog) {
          dailySessions.push(processSession(currentInLog, null))
        }

        // UNIFY SESSIONS: Merge contiguous/overlapping sessions into single rows
        if (dailySessions.length > 0) {
          const sortedSessions = [...dailySessions].sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime())
          
          let currentGroup = sortedSessions[0]
          const finalSessionsForDay: any[] = []
          
          for (let i = 1; i < sortedSessions.length; i++) {
            const nextOne = sortedSessions[i]
            const currentEnd = new Date(currentGroup.clockOut || new Date())
            const nextStart = new Date(nextOne.clockIn)
            const gapMins = (nextStart.getTime() - currentEnd.getTime()) / 60000
            
            if (gapMins <= 15) {
              currentGroup = {
                ...currentGroup,
                clockOut: nextOne.clockOut || currentGroup.clockOut,
                minutes: currentGroup.minutes + nextOne.minutes,
                regularMinutes: currentGroup.regularMinutes + nextOne.regularMinutes,
                overtimeMinutes: currentGroup.overtimeMinutes + nextOne.overtimeMinutes,
                isLate: currentGroup.isLate || nextOne.isLate,
                lateMinutes: Math.max(currentGroup.lateMinutes || 0, nextOne.lateMinutes || 0),
                isPenalty: currentGroup.isPenalty || nextOne.isPenalty,
                isAutoClockOut: currentGroup.isAutoClockOut || nextOne.isAutoClockOut,
                childSessions: [...(currentGroup.childSessions || [currentGroup]), nextOne]
              }
            } else {
              finalSessionsForDay.push(currentGroup)
              currentGroup = nextOne
            }
          }
          finalSessionsForDay.push(currentGroup)

          for (const session of finalSessionsForDay) {
            report.push({
              employee_id: emp.id,
              employee_name: emp.name,
              date: dateStr,
              regularMinutes: session.regularMinutes,
              overtimeMinutes: session.overtimeMinutes,
              isLate: session.isLate || false,
              isPenalty: session.isPenalty || false,
              lateMinutes: session.lateMinutes || 0,
              isAbsent: false,
              sessions: session.childSessions || [session],
              shift: session.shift, // Include the matched shift
              method: session.method,
              deviceInfo: session.deviceInfo,
              outletId: session.outletId
            })
          }
        }
      }

      // Check for unclaimed shifts (Absences)
      for (const shift of empDayShifts) {
        if (!claimedShiftIds.has(shift.id)) {
          const endTimeStr = shift.end_time || '23:59'
          const shiftEndObj = new Date(`${dateStr}T${endTimeStr}`)
          if (shift.start_time && endTimeStr < shift.start_time) {
            shiftEndObj.setDate(shiftEndObj.getDate() + 1)
          }
          
          if (new Date() > shiftEndObj) {
            report.push({
              employee_id: emp.id,
              employee_name: emp.name,
              date: dateStr,
              regularMinutes: 0,
              overtimeMinutes: 0,
              isLate: false,
              isPenalty: false,
              lateMinutes: 0,
              isAbsent: true,
              shift: shift, // Include the shift for absence display
              sessions: []
            })
          }
        }
      }
    }
  }

  return report
}

// New function for attendance statistics (Dashboard)
export async function getAttendanceStats(employeeId?: string) {
  const now = new Date()
  const firstDay = getLocalYYYYMMDD(new Date(now.getFullYear(), now.getMonth(), 1))
  const lastDay = getLocalYYYYMMDD(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  
  const reportData = await getAttendanceReportData(firstDay, lastDay)
  
  if (employeeId) {
    const empData = reportData.filter((r: any) => r.employee_id === employeeId)
    const totalRegHours = empData.reduce((sum: number, r: any) => sum + r.regularMinutes / 60, 0)
    const totalOTHours = empData.reduce((sum: number, r: any) => sum + r.overtimeMinutes / 60, 0)
    const lateCount = empData.filter((r: any) => r.isLate).length
    const penaltyCount = empData.filter((r: any) => r.isPenalty).length
    
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

export async function getMenuItemById(id: string): Promise<MenuItem | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) return null
    return data ? { ...data, category: data.type } : null
  }
  
  const items = await getMenuItems()
  return items.find(i => i.id === id) || null
}

// MENU FIX - Add menu must use only: name, type, price, status
// FIX DUPLICATE MENU: Check if menu exists before adding
// IF EXISTS: Update existing record instead of inserting duplicate
export async function addMenuItem(item: { name: string; type: string; price: number; packaging_cost?: number; status?: string; category?: string }, actorName: string = 'Admin'): Promise<MenuItem | null> {
  console.log("INVOKING addMenuItem with object:", JSON.stringify(item, null, 2))
  if (isSupabaseConfigured()) {
  // STEP 1: Check if menu_items WHERE name = input_name EXISTS
  const { data: existingItems, error: checkError } = await supabase
    .from('menu_items')
    .select('*')
    .eq('name', item.name)
    .range(0, 0)
  
  const existingItem = existingItems && existingItems.length > 0 ? existingItems[0] : null
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
    if (updateError) {
      console.error("SUPABASE UPDATE ERROR (addMenuItem):", updateError.message, updateError.details);
    }
    
    if (updateError) {
      return null
    }

    if (updatedData) {
      await logActivity(
        'menu_change',
        actorName,
        updatedData.name,
        `Menu Updated: ${updatedData.name} (${updatedData.type})`
      )
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
  if (error) {
    console.error("SUPABASE INSERT ERROR (addMenuItem):", error.message, error.details);
  }
  
  if (error) {
  return null
  }

  if (data) {
    await logActivity(
      'menu_change',
      actorName,
      data.name,
      `New Menu Added: ${data.name} (${data.type})`
    )
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

export async function updateMenuItem(id: string, updates: Partial<MenuItem>, actorName: string = 'Admin'): Promise<MenuItem | null> {
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

    if (data) {
      await logActivity(
        'menu_change',
        actorName,
        data.name,
        `Menu Updated: ${data.name}`
      )
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

export async function deleteMenuItem(id: string, actorName: string = 'Admin'): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id)
    
    console.log("ERROR (deleteMenuItem):", error)
    
    if (error) {
      return false
    }

    await logActivity(
      'menu_change',
      actorName,
      id,
      `Menu Deleted (ID: ${id})`
    )

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
  const shift = await getShiftOnDate(employeeId, date)
  return !!shift
}

export async function getShiftOnDate(employeeId: string, date: string): Promise<ShiftAssignment | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', date)
      .maybeSingle()
    
    if (error) {
      console.error("ERROR (getShiftOnDate):", error)
      return null
    }
    return data
  }
  
  const shifts = await getShiftAssignments()
  return shifts.find(s => s.employee_id === employeeId && s.date === date) || null
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
  console.log("[v0] addShiftAssignment (INSERT) called with:", assignment)
  
  // IMMUTABILITY: Prevent adding shifts for previous days
  if (isPastDate(assignment.date)) {
    console.error("Cannot add shift for a past date")
    return null
  }
  
  if (isSupabaseConfigured()) {
    const shiftData: any = {
      employee_id: assignment.employee_id,
      date: assignment.date,
      start_time: assignment.start_time,
      end_time: assignment.end_time,
      shift_config_id: assignment.shift_config_id || null
    }

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
  
  // Fallback...
  
  // Fallback for localStorage - ALWAYS INSERT, NO OVERWRITE
  const shifts = await getShiftAssignments()
  
  const newShift: ShiftAssignment = {
    ...assignment,
    id: generateId('shift')
  }
  shifts.push(newShift)
  setStoredData(STORAGE_KEYS.shiftAssignments, shifts)
  return newShift
}

export async function deleteShiftAssignment(id: string): Promise<boolean> {
  // IMMUTABILITY: Prevent deleting past shifts
  const existingShift = await getShiftAssignmentById(id)
  if (existingShift && isShiftLocked(existingShift.date, existingShift.start_time)) {
    console.error("Cannot delete a shift that has already started or passed")
    return false
  }

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
  // IMMUTABILITY: Prevent updating past shifts
  const existingShift = await getShiftAssignmentById(id)
  if (existingShift && isShiftLocked(existingShift.date, existingShift.start_time)) {
    console.error("Cannot update a shift that has already started or passed")
    return null
  }

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

// ========== OUTLETS ==========

export async function getOutlets(): Promise<Outlet[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('outlets')
      .select('*')
      .order('name', { ascending: true })
    
    if (error) {
      console.error("ERROR (getOutlets):", error)
      return []
    }
    return data || []
  }
  
  return getStoredData(STORAGE_KEYS.outlets, [
    { 
      id: 'main-1', 
      name: 'Main Outlet', 
      latitude: -6.200000, 
      longitude: 106.816666, 
      radius_meters: 100, 
      is_active: true 
    }
  ] as Outlet[])
}

export async function addOutlet(outlet: Omit<Outlet, 'id'>): Promise<Outlet | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('outlets')
      .insert([outlet])
      .select()
      .single()
    
    if (error) {
      console.error("ERROR (addOutlet):", error)
      return null
    }
    return data
  }
  
  const outlets = await getOutlets()
  const newOutlet = { ...outlet, id: generateId('out') } as Outlet
  outlets.push(newOutlet)
  setStoredData(STORAGE_KEYS.outlets, outlets)
  return newOutlet
}

export async function updateOutlet(id: string, updates: Partial<Outlet>): Promise<Outlet | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('outlets')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error("ERROR (updateOutlet):", error)
      return null
    }
    return data
  }
  
  const outlets = await getOutlets()
  const index = outlets.findIndex(o => o.id === id)
  if (index === -1) return null
  outlets[index] = { ...outlets[index], ...updates }
  setStoredData(STORAGE_KEYS.outlets, outlets)
  return outlets[index]
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
    notes: req.notes,
    is_scheduled: !!('is_scheduled' in req ? req.is_scheduled : (req as { isScheduled?: boolean }).isScheduled),
    scheduled_end_time: 'scheduled_end_time' in req ? req.scheduled_end_time : (req as { scheduledEndTime?: string }).scheduledEndTime,
    approved_overtime_minutes: 'approved_overtime_minutes' in req ? req.approved_overtime_minutes : (req as { approvedMinutes?: number }).approvedMinutes
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
    
    if (error) {
      console.error("CRITICAL ERROR (addOvertimeRequest):", error.message || "Unknown error", error)
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

export async function updateOvertimeRequest(id: string, updates: Partial<OvertimeRequest>): Promise<OvertimeRequest | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('overtime_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error("ERROR (updateOvertimeRequest):", error.message, error)
      return null
    }
    return data
  }
  
  const requests = await getOvertimeRequests()
  const index = requests.findIndex((r: OvertimeRequest) => r.id === id)
  if (index === -1) return null
  
  const updatedReq: OvertimeRequest = { ...requests[index], ...updates }
  requests[index] = updatedReq
  setStoredData(STORAGE_KEYS.overtimeRequests, requests)
  return updatedReq
}


export async function approveOvertimeRequest(id: string, reviewerName: string, approvedMinutes: number = 0): Promise<OvertimeRequest | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('overtime_requests')
      .update({
        status: 'approved',
        reviewed_by: reviewerName,
        reviewed_at: new Date().toISOString(),
        approved_overtime_minutes: approvedMinutes
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
    reviewed_at: new Date().toISOString(),
    approved_overtime_minutes: approvedMinutes
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

export async function deleteOvertimeRequest(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('overtime_requests')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error("ERROR (deleteOvertimeRequest):", error)
      return false
    }
    return true
  }
  
  const requests = await getOvertimeRequests()
  const filtered = requests.filter(r => r.id !== id)
  if (requests.length === filtered.length) return false
  
  setStoredData(STORAGE_KEYS.overtimeRequests, filtered)
  return true
}

export async function getOvertimeRequestsByEmployee(employeeId: string): Promise<OvertimeRequest[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('overtime_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .order('request_date', { ascending: false })
    
    if (error) {
      console.error("ERROR (getOvertimeRequestsByEmployee):", error)
      return []
    }
    return data || []
  }
  
  const requests = await getOvertimeRequests()
  return requests.filter(r => r.employee_id === employeeId)
}

export async function getScheduledOvertime(employeeId: string, date: string): Promise<OvertimeRequest | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('overtime_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('request_date', date)
      .eq('is_scheduled', true)
      .eq('status', 'approved')
      .maybeSingle()
    
    if (error) {
      console.error("ERROR (getScheduledOvertime):", error)
      return null
    }
    return data
  }
  
  const requests = await getOvertimeRequests()
  return requests.find(r => 
    r.employee_id === employeeId && 
    r.request_date === date && 
    r.is_scheduled === true
  ) || null
}

// ========== HELPER FUNCTIONS ==========

export function getStockHealth(item: InventoryItem): "healthy" | "warning" | "critical" {
  const stock = item.stock || item.current_stock || 0
  const dailyUsage = item.daily_usage || 1
  const minStock = item.min_stock || 0
  
  if (stock <= 0) return "critical"
  
  // 1. Min stock check (User's primary concern)
  if (stock < minStock) return "warning"
  
  // 2. Daily usage check (Longevity concern)
  const daysRemaining = stock / dailyUsage
  if (daysRemaining <= 1) return "critical"
  if (daysRemaining <= 3) return "warning"
  
  return "healthy"
}

export function getDaysRemaining(item: InventoryItem): number {
  const stock = item.stock || item.current_stock || 0
  const dailyUsage = item.daily_usage || 1
  return Math.max(0, Math.round((stock / dailyUsage) * 10) / 10)
}

/**
 * Calculates the rolling daily usage for an item based on sales logs from the last 7 days.
 * This looks up all menu recipes that use this item, aggregates the total quantity sold,
 * and divides by 7.
 */
export async function calculateRollingDailyUsage(itemId: string): Promise<number> {
  if (isSupabaseConfigured()) {
    const today = new Date()
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    
    // 1. Get all sales in last 7 days
    const { data: sales, error: salesError } = await supabase
      .from('sales_logs')
      .select('menu_id, quantity')
      .gte('created_at', sevenDaysAgo)
    
    if (salesError || !sales) return 0
    
    // 2. Get all recipes
    const { data: recipes, error: recipeError } = await supabase
      .from('menu_recipes')
      .select('menu_item_id, quantity, unit')
      .eq('inventory_item_id', itemId)
    
    if (recipeError || !recipes) return 0
    
    // Map recipe quantity (in base unit) for each menu
    const recipeMap = new Map<string, { quantity: number; unit: string }>()
    recipes.forEach(r => recipeMap.set(r.menu_item_id, { quantity: r.quantity, unit: r.unit }))
    
    // 3. Sum up usage
    let totalUsage = 0
    sales.forEach(sale => {
      const recipe = recipeMap.get(sale.menu_id)
      if (recipe) {
        totalUsage += sale.quantity * recipe.quantity
      }
    })
    
    // 4. Return average per day (divided by 7)
    return parseFloat((totalUsage / 7).toFixed(4))
  }
  
  return 0
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

// Get on-shift employees based on today's and yesterday's attendance (for cross-day shifts)
export async function getOnShiftEmployees(): Promise<Employee[]> {
  const today = getLocalYYYYMMDD()
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = getLocalYYYYMMDD(yesterdayDate)
  
  // Fetch logs, shifts, and OT from both days to handle shifts that cross midnight and OT rules
  const [todayLogs, yesterdayLogs, todayShifts, yesterdayShifts, todayOT, yesterdayOT, employees] = await Promise.all([
    getAttendanceLogsByDate(today),
    getAttendanceLogsByDate(yesterday),
    getShiftAssignmentsInRange(today, today),
    getShiftAssignmentsInRange(yesterday, yesterday),
    getOvertimeRequestsInRange(today, today),
    getOvertimeRequestsInRange(yesterday, yesterday),
    getActiveEmployees()
  ])
  
  const allLogs = [...yesterdayLogs, ...todayLogs]
  const allShifts = [...yesterdayShifts, ...todayShifts]
  const allOT = [...yesterdayOT, ...todayOT]
  const otMap = new Map(allOT.map(r => [r.attendance_log_id, r]))
  
  const clockedIn = new Set<string>()
  const lastInLogs = new Map<string, AttendanceLog>()
  
  // Sort logs chronologically and process
  const sortedLogs = allLogs.sort((a, b) => {
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
      lastInLogs.set(log.employee_id, log)
    } else {
      clockedIn.delete(log.employee_id)
      lastInLogs.delete(log.employee_id)
    }
  })

  // Final validation: check for auto-tap-out (8-hour limit or shift end)
  for (const empId of clockedIn) {
    const lastInLog = lastInLogs.get(empId)
    if (!lastInLog) continue

    const empShift = allShifts.find(s => s.employee_id === empId && s.date === lastInLog.date)
    const otReq = otMap.get(lastInLog.id)

    // Reuse the regulation logic. If it determines an auto-clock-out, remove from list.
    const session = calculateRegulatedSession(lastInLog, null, empShift, otReq?.status, otReq?.approved_overtime_minutes)
    if (session.isAutoClockOut) {
      clockedIn.delete(empId)
    }
  }
  
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
      const today = getLocalYYYYMMDD()
      
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
  total_price?: number // Optional custom price override for bundles/discounts
}

export async function bulkSellMenu(items: BulkSaleItem[], customDate?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    console.log("Executing manual JS bulk sell menu...");
    
    // Determine if we should skip inventory deduction (if it's a past date)
    // IMPORTANT: Use LOCAL date, not UTC, to correctly handle post-midnight sales in WIB (UTC+7)
    const now2 = new Date();
    const today = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}-${String(now2.getDate()).padStart(2, '0')}`;
    const isPastDate = customDate && customDate !== today;
    
    // For TODAY's sales: use current timestamp as-is (correct local date)
    // For PAST sales: use noon local time to avoid timezone day-boundary shifts
    let finalTimestamp = new Date().toISOString();
    if (isPastDate && customDate) {
      const [year, month, day] = customDate.split('-').map(Number);
      const d = new Date(year, month - 1, day, 12, 0, 0); // noon local time
      finalTimestamp = d.toISOString();
    }
    
    for (const item of items) {
      // ... same finalPrice logic ...
      let finalPrice = item.total_price;
      if (finalPrice === undefined || finalPrice === null) {
        const { data: menuData } = await supabase
          .from('menu_items')
          .select('price')
          .eq('id', item.menu_id)
          .single();
        finalPrice = (menuData?.price || 0) * item.quantity;
      }

      // 1. Insert into sales_logs
      const { error: logErr } = await supabase.from('sales_logs').insert({
        menu_id: item.menu_id,
        menu_item_id: item.menu_id,
        quantity: item.quantity,
        total_price: finalPrice,
        created_at: finalTimestamp
      });
      
      if (logErr) {
        console.error("Failed to insert sales_log:", logErr);
        continue;
      }

      // 2. SKIP inventory deduction if it's a past date
      if (isPastDate) {
        console.log(`Skipping inventory deduction for historical sale of item ${item.menu_id}`);
        continue;
      }

      // 3. Fetch recipes for this menu item (ONLY for current sales)
      const { data: ingredients } = await supabase
        .from('menu_recipes')
        .select('*')
        .eq('menu_item_id', item.menu_id);
        
      if (!ingredients || ingredients.length === 0) {
        console.warn(`No recipe found for menu item ${item.menu_id}`);
        continue;
      }

      // 3. Deduct from floor batches (FIFO: oldest expiry first)
      for (const ing of ingredients) {
        let neededQty = Number(ing.quantity) * item.quantity;
        if (neededQty <= 0) continue;

        const { data: batches } = await supabase
          .from('inventory_batches')
          .select('*')
          .eq('item_id', ing.inventory_item_id)
          .eq('location', 'floor')
          .gt('remaining_quantity', 0)
          .order('received_date', { ascending: true })
          .order('batch_number', { ascending: true });

        if (!batches || batches.length === 0) {
          console.warn(`No floor batch found for ingredient ${ing.inventory_item_id}`);
          continue;
        }

        for (const batch of batches) {
          if (neededQty <= 0) break;

          const available = Number(batch.remaining_quantity);
          if (available >= neededQty) {
            // Deduct fully
            await supabase.from('inventory_batches')
              .update({ remaining_quantity: available - neededQty })
              .eq('id', batch.id);
            neededQty = 0;
          } else {
            // Deplete this batch and continue needing more
            await supabase.from('inventory_batches')
              .update({ remaining_quantity: 0 })
              .eq('id', batch.id);
            neededQty -= available;
          }
        }
      }
    }

    return true;
  } catch (err) {
    console.error("CRITICAL ERROR (bulkSellMenu JS):", err);
    return false;
  }
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
    // Ensure the date string is treated as UTC if it doesn't specify a timezone
    let dateStr = log.created_at;
    if (dateStr && !dateStr.includes('Z') && !dateStr.includes('+')) {
      dateStr = dateStr.replace(' ', 'T') + 'Z';
    }
    
    const date = getLocalYYYYMMDD(new Date(dateStr))
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
  expired_date: string | null
  notes?: string
  is_opened?: boolean
}

export interface DBInventoryBatch {
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
  is_opened: boolean
  opened_at?: string
  created_at: string
}

export async function openBatch(batchId: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('inventory_batches')
      .update({ 
        is_opened: true, 
        opened_at: new Date().toISOString() 
      })
      .eq('id', batchId)
    
    if (error) {
      console.error("ERROR (openBatch):", error)
      return false
    }
    return true
  }
  return false
}

// Generate batch number: CATEGORY-YYYYMMDD-HHMMSS
function generateBatchNumber(category: string): string {
  const now = new Date()
  // Use YYMMDD (6 chars) + HHMMSS (6 chars) + Prefix (3 chars) + separators = ~18 chars
  const date = getLocalYYYYMMDD(now).replace(/-/g, '').substring(2) // YYMMDD
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '') // HHMMSS
  const prefix = (category || 'INV').substring(0, 3).toUpperCase()
  return `${prefix}-${date}-${time}`
}

export async function addBatch(data: AddBatchData, actorName: string = 'System'): Promise<InventoryBatch | null> {
  // We assume the caller (Admin/Ops) already converted quantity to base unit
  const quantityInBaseUnit = data.quantity;

  if (isSupabaseConfigured()) {
    // First get the item to get its category for batch number generation and unit conversion
    const item = await getInventoryItem(data.item_id)
    if (!item) {
      console.log("ERROR (addBatch): Item not found")
      return null
    }
    
    const batchNumber = generateBatchNumber(item.category)
    let finalBatch: InventoryBatch | null = null;
    
    // Aggressive Debug: Bypass RPC and use direct inserts for perfect control
    console.log("BYPASSING RPC for addBatch - using direct inserts for item:", data.item_id);
    
    // 1. INSERT into inventory_batches
    const insertData: any = {
      item_id: data.item_id,
      batch_number: batchNumber,
      quantity: Number(quantityInBaseUnit) || 0,
      remaining_quantity: Number(quantityInBaseUnit) || 0,
      cost_per_unit: Number(data.unit_cost) || 0,
      supplier_name: data.supplier_name || 'Unknown',
      received_date: data.received_date || new Date().toISOString().split('T')[0],
      expired_date: data.expired_date && data.expired_date.trim() !== "" ? data.expired_date : null,
      notes: data.notes || '',
      is_opened: data.is_opened || false,
      location: 'warehouse'
    }
    
    if (data.is_opened) {
      insertData.opened_at = new Date().toISOString()
    }

    console.log("STEP 1: Inserting batch...", JSON.stringify(insertData));
    const { data: batchData, error: batchError } = await supabase
      .from('inventory_batches')
      .insert([insertData])
      .select()
      .single()
    
    if (batchError) {
      console.error("ERROR (addBatch insert):", JSON.stringify(batchError))
      return null
    }
    
    finalBatch = batchData
    console.log("STEP 2: Updating master stock...");
    
    // 2. UPDATE inventory_items: stock = stock + quantity
    const currentStock = Number(item.stock) || 0
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ 
        stock: currentStock + (Number(quantityInBaseUnit) || 0)
        // Removed updated_at as it doesn't exist in schema
      })
      .eq('id', data.item_id)
    
    if (updateError) {
      console.error("ERROR (addBatch update stock):", JSON.stringify(updateError))
    }
    
    console.log("STEP 3: Recording transaction...");
    // 3. INSERT into inventory_transactions: type = 'IN'
    const { error: txError } = await supabase
      .from('inventory_transactions')
      .insert([{
        item_id: data.item_id,
        type: 'in',
        quantity: Number(quantityInBaseUnit) || 0,
        employee_id: null,
        actor_name: actorName
        // Removed notes as it doesn't exist in schema
      }])
    
    if (txError) {
      console.error("ERROR (addBatch transaction):", JSON.stringify(txError))
    }

    if (finalBatch) {
      console.log("FINALIZING Stock In: logging activity...");
      // Make logging non-blocking
      logActivity(
        'inventory_change', 
        actorName, 
        item.name, 
        `Stock In: ${data.quantity} ${data.unit} added for ${item.name}`
      ).catch(e => console.error("Log Activity failed:", JSON.stringify(e)));
    }
    
    console.log("Stock In SUCCESSFUL for:", item.name);
    return finalBatch
  }

  // Fallback for localStorage - simplified
  const inventory = await getInventory()
  const item = inventory.find(i => i.id === data.item_id)
  if (!item) return null
  
  const batchNumber = generateBatchNumber(item.category)
  const newBatch: InventoryBatch = {
    id: `batch-${Date.now()}`,
    inventoryItemId: data.item_id,
    batchNumber: batchNumber,
    supplier: data.supplier_name,
    receivedDate: data.received_date,
    expiryDate: data.expired_date,
    initialQuantity: quantityInBaseUnit,
    currentQuantity: quantityInBaseUnit,
    unitCost: data.unit_cost,
    notes: data.notes,
    is_opened: data.is_opened || false,
    status: 'active',
    createdAt: new Date().toISOString()
  }
  
  // Update stock locally
  const index = inventory.findIndex(i => i.id === data.item_id)
  if (index !== -1) {
    const newStock = (inventory[index].stock ?? 0) + quantityInBaseUnit
    inventory[index] = { 
      ...inventory[index], 
      stock: newStock, 
      currentStock: newStock,
      current_stock: newStock 
    }
    setStoredData(STORAGE_KEYS.inventory, inventory)
  }
  
  return newBatch
}

// ========== BATCH MANAGEMENT HELPERS ==========

export async function updateBatch(batchId: string, updates: Partial<InventoryBatch>): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('inventory_batches')
      .update(updates)
      .eq('id', batchId)
    
    if (error) {
      console.error("ERROR (updateBatch):", error)
      return false
    }
    return true
  }
  return false
}




// ========== DELETE BATCH ==========
// Completely remove a batch and reverse its impact on master stock
export async function deleteBatch(batchId: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      // 1. Get batch details first to know item_id and quantity
      const { data: batch, error: getError } = await supabase
        .from('inventory_batches')
        .select('item_id, quantity, remaining_quantity')
        .eq('id', batchId)
        .single()
      
      if (getError || !batch) {
        console.error("ERROR (deleteBatch - fetch):", getError)
        return false
      }

      // 2. Delete the batch
      const { error: deleteError } = await supabase
        .from('inventory_batches')
        .delete()
        .eq('id', batchId)
      
      if (deleteError) {
        console.error("ERROR (deleteBatch - delete):", deleteError)
        return false
      }

      // 3. Reverse the stock in master inventory
      // We reverse the INITIAL quantity because that's what was added to the master stock
      const { data: item } = await supabase
        .from('inventory_items')
        .select('stock')
        .eq('id', batch.item_id)
        .single()
      
      if (item) {
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update({ stock: (item.stock || 0) - batch.quantity })
          .eq('id', batch.item_id)
        
        if (updateError) {
          console.error("ERROR (deleteBatch - update stock):", updateError)
        }
      }

      // 4. Log the deletion
      await logActivity(
        'inventory_change',
        'Admin',
        'Batch Deletion',
        `Batch ${batchId} deleted. Stock reversed by ${batch.quantity}`
      )

      return true
    } catch (err) {
      console.error("CRITICAL ERROR (deleteBatch):", err)
      return false
    }
  }
  return false
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

export async function cancelPayrollItems(employeeIds: string[], startDate: string, endDate: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('payrolls')
      .update({ 
        status: 'draft', 
        updated_at: new Date().toISOString() 
      })
      .in('employee_id', employeeIds)
      .eq('start_date', startDate)
      .eq('end_date', endDate)
    
    if (error) {
      console.error("ERROR (cancelPayrollItems):", error)
      return false
    }
    return true
  }
  return false
}

export async function getAllMenuRecipes(): Promise<any[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('menu_recipes')
      .select('*')
    
    if (error) {
      console.error("ERROR (getAllMenuRecipes):", error)
      return []
    }
    return data || []
  }
  return []
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

// ========== BATCHES ==========

export async function getBatches(location?: 'warehouse' | 'floor'): Promise<InventoryBatch[]> {
  if (isSupabaseConfigured()) {
    const { data: batches, error } = await supabase
      .from('inventory_batches')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error("ERROR (getBatches):", JSON.stringify(error))
      return []
    }
    
    // Filter by location if specified
    const filteredBatches = location 
      ? batches.filter(b => b.location === location) 
      : batches

    // Fetch items for mapping
    const { data: items } = await supabase.from('inventory_items').select('id, name, category, unit')
    
    // Map to camelCase for the app
    return (filteredBatches || []).map(b => {
      const item = (items || []).find(i => i.id === b.item_id);
      return {
        id: b.id,
        batchNumber: b.batch_number,
        inventoryItemId: b.item_id,
        inventoryItemName: item?.name || 'Unknown Item',
        category: item?.category || '',
        unit: item?.unit || 'pcs',
        initialQuantity: Number(b.quantity),
        currentQuantity: Number(b.remaining_quantity),
        receivedDate: b.received_date,
        expiryDate: b.expired_date,
        unitCost: Number(b.cost_per_unit),
        supplier: b.supplier_name || '',
        status: b.remaining_quantity <= 0 ? 'depleted' : 'active',
        is_opened: b.is_opened,
        location: b.location,
        createdAt: b.created_at || new Date().toISOString()
      };
    }) as InventoryBatch[];
  }
  return []
}

export async function getBatchesByItem(itemId: string, location?: 'warehouse' | 'floor'): Promise<InventoryBatch[]> {
  if (isSupabaseConfigured()) {
    let query = supabase
      .from('inventory_batches')
      .select('*')
      .eq('item_id', itemId)
    
    if (location) {
      query = query.eq('location', location)
    }
    
    const { data, error } = await query.order('received_date', { ascending: true }).order('created_at', { ascending: true })

    if (error) {
      console.error("ERROR (getBatchesByItem):", error)
      return []
    }

    return (data || []).map(b => ({
      id: b.id,
      batchNumber: b.batch_number,
      inventoryItemId: b.item_id,
      initialQuantity: Number(b.quantity),
      currentQuantity: Number(b.remaining_quantity),
      receivedDate: b.received_date,
      expiryDate: b.expired_date,
      unitCost: Number(b.cost_per_unit),
      supplier: b.supplier_name || '',
      status: b.remaining_quantity <= 0 ? 'depleted' : 'active',
      is_opened: b.is_opened,
      location: b.location,
      notes: b.notes,
      createdAt: b.created_at || new Date().toISOString()
    })) as InventoryBatch[]
  }
  return []
}

// Get Inventory Movement History from inventory_transactions table
export async function getInventoryMovements(): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500); // Increased limit

  if (error) {
    console.error("ERROR (getInventoryMovements):", error);
    return [];
  }

  // Join with item names
  const { data: items } = await supabase.from('inventory_items').select('id, name');
  const itemMap = new Map((items || []).map(i => [i.id, i.name]));
  return (data || []).map(t => {
    // Try to extract batch number from waste_reason if it follows our patterns
    let batchNumber = '-';
    if (t.waste_reason) {
      const match = t.waste_reason.match(/batch\s*[:\s]\s*([A-Z0-9-]{4,})/i) || t.waste_reason.match(/Transfer\s*[:\s]\s*([A-Z0-9-]{4,})/i);
      if (match) batchNumber = match[1];
    }

    return {
      id: t.id,
      timestamp: t.created_at,
      batchNumber: batchNumber,
      inventoryItemId: t.item_id,
      inventoryItemName: itemMap.get(t.item_id) || 'Unknown',
      type: t.type || 'out',
      quantity: Number(t.quantity) || 0,
      employeeName: t.actor_name || '-',
      reason: t.waste_reason || '',
      notes: ''
    };
  });
}

// Transfer from Warehouse to Floor (Stock Out to Bar)
export async function transferToFloor(batchIdOrIds: string | string[], quantity: number, actorName: string, reason?: string, splitSize?: number, itemId?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const batchIds = Array.isArray(batchIdOrIds) ? batchIdOrIds : [batchIdOrIds];
    const firstBatchId = batchIds[0];

    let derivedItemId = itemId;
    let initialBatch = null;
    
    if (firstBatchId && firstBatchId !== '') {
      const { data } = await supabase.from('inventory_batches').select('*').eq('id', firstBatchId).single();
      initialBatch = data;
    }

    if (!derivedItemId) {
      if (!initialBatch) return false;
      derivedItemId = initialBatch.item_id;
    }
    const finalItemId = derivedItemId;

    // 2. Get the target batches to deduct from
    let targetBatches = [];
    if (Array.isArray(batchIdOrIds)) {
      // Explicitly selected batches
      const { data } = await supabase.from('inventory_batches').select('*').in('id', batchIds);
      // Sort them in the order they were selected or by date
      targetBatches = (data || []).sort((a, b) => batchIds.indexOf(a.id) - batchIds.indexOf(b.id));
    } else {
      // FIFO Overflow logic starting from batchId
      const { data: allWarehouse } = await supabase
        .from('inventory_batches')
        .select('*')
        .eq('item_id', finalItemId)
        .eq('location', 'warehouse')
        .gt('remaining_quantity', 0)
        .order('received_date', { ascending: true })
        .order('batch_number', { ascending: true });
      
      const startIndex = (allWarehouse || []).findIndex(b => b.id === firstBatchId);
      targetBatches = (allWarehouse || []).slice(startIndex === -1 ? 0 : startIndex);
    }

    let remainingToTransfer = quantity;
    let totalDeducted = 0;
    const sourceBatches = [];

    for (const b of targetBatches) {
      if (remainingToTransfer <= 0) break;
      const deduct = Math.min(b.remaining_quantity, remainingToTransfer);
      
      await supabase.from('inventory_batches').update({ remaining_quantity: b.remaining_quantity - deduct }).eq('id', b.id);
      
      remainingToTransfer -= deduct;
      totalDeducted += deduct;
      sourceBatches.push({ ...b, deducted: deduct });
    }

    // 3. Smart Auto-Waste: Only waste existing floor batches if they are older than 5 minutes
    // This allows multiple transfers in a single 'session' to stay active together.
    const { data: floorBatches } = await supabase
      .from('inventory_batches')
      .select('*')
      .eq('item_id', finalItemId)
      .eq('location', 'floor')
      .gt('remaining_quantity', 0);
      
    if (floorBatches && floorBatches.length > 0) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      for (const old of floorBatches) {
        // Only waste if the batch was created more than 5 minutes ago
        if (old.created_at < fiveMinutesAgo) {
          await supabase.from('inventory_transactions').insert({
            item_id: finalItemId,
            type: 'waste',
            quantity: old.remaining_quantity,
            waste_reason: `Auto-waste (Stale stock): ${reason || 'Diganti stok baru'}`,
            actor_name: actorName,
            created_at: new Date().toISOString()
          });
          await supabase.from('inventory_batches').update({ remaining_quantity: 0 }).eq('id', old.id);
        }
      }
    }

    // 4. Update master stock
    await supabase.rpc('decrement_inventory_stock', { p_item_id: finalItemId, p_quantity: totalDeducted });

    // 5. Create new floor batch(es)
    const mainBatch = sourceBatches[0] || initialBatch;
    let chunks = [];
    const sSize = splitSize || 1;
    if (sSize > 0 && totalDeducted > sSize) {
      const numFullChunks = Math.floor(totalDeducted / sSize);
      const remainder = totalDeducted % sSize;
      for (let i = 0; i < numFullChunks; i++) chunks.push(sSize);
      if (remainder > 0) chunks.push(remainder);
    } else {
      chunks.push(totalDeducted);
    }

    for (let i = 0; i < chunks.length; i++) {
      await supabase.from('inventory_batches').insert({
        item_id: finalItemId,
        quantity: chunks[i],
        remaining_quantity: chunks[i],
        cost_per_unit: mainBatch.cost_per_unit,
        supplier_name: (mainBatch.supplier_name && !mainBatch.supplier_name.includes('General Supplier')) ? mainBatch.supplier_name : 'Unknown',
        received_date: mainBatch.received_date,
        expired_date: mainBatch.expired_date,
        batch_number: (mainBatch.batch_number || '').substring(0, 16) + (chunks.length > 1 ? `-${i+1}` : 'F'),
        is_opened: true,
        location: 'floor'
      });
    }

    // 6. Log transaction
    await supabase.from('inventory_transactions').insert({
      item_id: finalItemId,
      type: 'out',
      quantity: totalDeducted,
      actor_name: actorName,
      waste_reason: reason ? `${reason} (Transfer: ${mainBatch.batch_number})` : `Transfer to Bar: ${mainBatch.batch_number} (Used ${sourceBatches.length} batches)`,
      created_at: new Date().toISOString()
    });

    return true;
  } catch (err) {
    console.error("CRITICAL ERROR (transferToFloor):", err);
    return false;
  }
}

// Manual Stock Out (Waste, Damage, etc.) with Multi-Batch support
export async function stockOutManual(
  batchIdOrIds: string | string[], 
  quantity: number, 
  reason: string,
  actorName: string = 'System',
  itemId?: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const batchIds = Array.isArray(batchIdOrIds) ? batchIdOrIds : [batchIdOrIds];
    const firstBatchId = batchIds[0];

    let derivedItemId = itemId;
    if (!derivedItemId) {
      const { data: initialBatch } = await supabase.from('inventory_batches').select('item_id').eq('id', firstBatchId).single();
      if (!initialBatch) return false;
      derivedItemId = initialBatch.item_id;
    }
    const finalItemId = derivedItemId;

    let targetBatches = [];
    const isArrayOfIds = Array.isArray(batchIdOrIds) && batchIdOrIds.length > 0 && batchIdOrIds[0] !== '';
    
    if (isArrayOfIds) {
      const batchIds = Array.isArray(batchIdOrIds) ? batchIdOrIds : [batchIdOrIds];
      const { data } = await supabase.from('inventory_batches').select('*').in('id', batchIds);
      targetBatches = (data || []).sort((a, b) => batchIds.indexOf(a.id) - batchIds.indexOf(b.id));
    } else {
      // FIFO Fallback
      const startId = Array.isArray(batchIdOrIds) ? batchIdOrIds[0] : batchIdOrIds;
      const { data: allWarehouse } = await supabase
        .from('inventory_batches')
        .select('*')
        .eq('item_id', finalItemId)
        .eq('location', 'warehouse')
        .gt('remaining_quantity', 0)
        .order('received_date', { ascending: true })
        .order('batch_number', { ascending: true });
      
      if (startId && startId !== '') {
        const startIndex = (allWarehouse || []).findIndex(b => b.id === startId);
        targetBatches = (allWarehouse || []).slice(startIndex === -1 ? 0 : startIndex);
      } else {
        targetBatches = allWarehouse || [];
      }
    }

    let remainingToDeduct = quantity;
    let totalDeducted = 0;

    for (const b of targetBatches) {
      if (remainingToDeduct <= 0) break;
      const deduct = Math.min(b.remaining_quantity, remainingToDeduct);
      await supabase.from('inventory_batches').update({ remaining_quantity: b.remaining_quantity - deduct }).eq('id', b.id);
      await supabase.from('inventory_transactions').insert({
        item_id: finalItemId,
        type: 'waste',
        quantity: deduct,
        waste_reason: reason ? `${reason} (Batch: ${b.batch_number})` : `Deducted from batch ${b.batch_number}`,
        actor_name: actorName,
        created_at: new Date().toISOString()
      });
      remainingToDeduct -= deduct;
      totalDeducted += deduct;
    }

    if (totalDeducted > 0) {
      await supabase.rpc('decrement_inventory_stock', { p_item_id: finalItemId, p_quantity: totalDeducted });
      return true;
    }
    return false;
  } catch (err) {
    console.error("CRITICAL ERROR (stockOutManual):", err);
    return false;
  }
}

// Update existing batch details (Edit Sub-item)
export async function updateBatchDetails(batchId: string, details: Partial<InventoryBatch>): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      // Map back to snake_case
      const dbDetails: any = {}
      if (details.unitCost !== undefined) dbDetails.cost_per_unit = details.unitCost
      if (details.supplier !== undefined) dbDetails.supplier_name = details.supplier
      if (details.receivedDate !== undefined) dbDetails.received_date = details.receivedDate
      if (details.expiryDate !== undefined) dbDetails.expired_date = details.expiryDate
      // @ts-ignore
      if (details.notes !== undefined) dbDetails.notes = details.notes
      if (details.currentQuantity !== undefined) dbDetails.remaining_quantity = details.currentQuantity

      const { error } = await supabase
        .from('inventory_batches')
        .update(dbDetails)
        .eq('id', batchId)
      
      if (error) {
        console.error("ERROR (updateBatchDetails):", error)
        return false
      }
      return true
    } catch (err) {
      console.error("CRITICAL ERROR (updateBatchDetails):", err)
      return false
    }
  }
  return false
}

// Record manual batch movement and persist to DB
export async function recordBatchMovement(
  batchId: string, 
  quantity: number, 
  type: 'in' | 'out' | 'waste' | 'adjustment', 
  actorName: string, 
  reason?: string, 
  notes?: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    // 1. Get batch info
    const { data: batch, error: batchError } = await supabase
      .from('inventory_batches')
      .select('batch_number, remaining_quantity, item_id')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) throw new Error("Batch not found");

    // 2. Calculate new quantity
    let newQuantity = Number(batch.remaining_quantity);
    if (type === 'in') {
      newQuantity += quantity;
    } else {
      newQuantity = Math.max(0, newQuantity - quantity);
    }

    // 3. Update batch quantity
    const { error: updateError } = await supabase
      .from('inventory_batches')
      .update({ 
        remaining_quantity: newQuantity
      })
      .eq('id', batchId);

    if (updateError) throw updateError;

    // 4. Log to inventory_transactions
    // Format reason to include batch number for parsing in getInventoryMovements
    const fullReason = `${reason || 'Manual Adjustment'}${notes ? ` - ${notes}` : ''} (Batch: ${batch.batch_number})`;
    
    const { error: logError } = await supabase
      .from('inventory_transactions')
      .insert({
        item_id: batch.item_id,
        type: type === 'in' ? 'in' : (type === 'waste' ? 'waste' : 'out'),
        quantity: quantity,
        actor_name: actorName,
        waste_reason: fullReason,
        created_at: new Date().toISOString()
      });

    if (logError) throw logError;

    return true;
  } catch (err) {
    console.error("CRITICAL ERROR (recordBatchMovement):", err);
    return false;
  }
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

export async function lockPayrollToAnalytics(month: string, amount: number): Promise<boolean> {
  if (isSupabaseConfigured()) {
    // 1. Delete any existing locked payroll for this month to avoid duplicates
    await supabase
      .from('monthly_opex')
      .delete()
      .eq('month', month)
      .eq('category', 'Staff Payroll (Locked)')
    
    // 2. Insert new one
    const { error } = await supabase
      .from('monthly_opex')
      .insert([{
        month,
        category: 'Staff Payroll (Locked)',
        amount,
        notes: `Locked from Payroll Module on ${new Date().toLocaleString()}`
      }])
    
    if (error) {
      console.error("ERROR (lockPayrollToAnalytics):", error)
      return false
    }
    return true
  }
  return false
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
  if (!isSupabaseConfigured()) return null;

  try {
    // 1. Insert Opname Record
    const { data: result, error } = await supabase
      .from('inventory_opname')
      .insert([data])
      .select()
      .single();
    
    if (error) {
      console.error("ERROR (addInventoryOpname):", error);
      return null;
    }

    const difference = data.difference;
    const itemId = data.item_id;

    if (difference < 0) {
      // CASE: Shrinkage (Missing stock)
      // Deduct from ALL active batches using FIFO (Warehouse first, then Floor)
      let neededToDeduct = Math.abs(difference);
      
      // Fetch all batches with stock, prioritize warehouse for audit deductions
      const { data: batches } = await supabase
        .from('inventory_batches')
        .select('*')
        .eq('item_id', itemId)
        .gt('remaining_quantity', 0)
        .order('location', { ascending: false }) // 'warehouse' comes after 'floor' alphabetically, but we want warehouse first? 
        // Wait, 'warehouse' > 'floor'. Ascending=false puts warehouse first.
        .order('received_date', { ascending: true });

      for (const batch of batches || []) {
        if (neededToDeduct <= 0) break;
        
        const available = Number(batch.remaining_quantity);
        const deduct = Math.min(available, neededToDeduct);
        
        await supabase.from('inventory_batches')
          .update({ remaining_quantity: available - deduct })
          .eq('id', batch.id);
          
        neededToDeduct -= deduct;
      }
    } else if (difference > 0) {
      // CASE: Extra stock found
      // Create a new adjustment batch with a unique ID
      const timestamp = new Date().getTime().toString().slice(-4);
      await supabase.from('inventory_batches').insert({
        item_id: itemId,
        quantity: difference,
        remaining_quantity: difference,
        batch_number: `ADJ-${new Date().toISOString().split('T')[0]}-${timestamp}`,
        location: 'warehouse',
        notes: `Opname Adjustment: ${data.reason || 'Found extra stock'}`
      });
    }

    // 2. Update master stock column (legacy support, though UI uses batches)
    await supabase.from('inventory_items')
      .update({ stock: data.actual_stock, last_updated: new Date().toISOString() })
      .eq('id', itemId);

    // 3. Log transaction
    if (difference !== 0) {
      const type = difference < 0 ? 'waste' : 'in';
      await supabase.from('inventory_transactions').insert({
        item_id: itemId,
        type: type,
        quantity: Math.abs(difference),
        actor_name: data.actor_name,
        waste_reason: `Stock Opname Adjustment: ${data.reason || (difference < 0 ? 'Shrinkage' : 'Found extra')}`,
        created_at: new Date().toISOString()
      });
    }

    return result;
  } catch (err) {
    console.error("CRITICAL ERROR (addInventoryOpname JS):", err);
    return null;
  }
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

// ========== STORAGE INTEGRATION ==========
export async function uploadEmployeeFile(file: File, bucket: 'avatars' | 'contracts', path: string): Promise<string | null> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', bucket)
    formData.append('filename', path)

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    
    const json = await res.json()
    if (json.success) {
      return json.path
    }
    
    console.error(`Error uploading to ${bucket}:`, json.error)
    return null
  } catch (e) {
    console.error(`Exception uploading to ${bucket}:`, e)
    return null
  }
}

export async function getEmployeeFileUrl(path: string, bucket: 'avatars' | 'contracts'): Promise<string | null> {
  if (!path) return null
  if (path.startsWith('/resources/')) return path
  return `/resources/${bucket}/${path}`
}

// ========== EMPLOYEE KPI ==========

export async function getEmployeeKPIs(employeeId: string): Promise<EmployeeKPI[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('employee_kpis')
      .select('*')
      .eq('employee_id', employeeId)
      .order('date', { ascending: false })
    
    if (error) {
      console.error("ERROR (getEmployeeKPIs):", error)
      return []
    }
    return data || []
  }
  return []
}

export async function addEmployeeKPI(data: Omit<EmployeeKPI, 'id' | 'created_at'>): Promise<EmployeeKPI | null> {
  if (isSupabaseConfigured()) {
    const { data: result, error } = await supabase
      .from('employee_kpis')
      .insert([data])
      .select()
      .single()
    
    if (error) {
      console.error("ERROR (addEmployeeKPI):", error)
      return null
    }
    
    // Get employee name for better logging
    const { data: emp } = await supabase.from('employees').select('name, nickname').eq('id', data.employee_id).single()
    const targetName = emp ? (emp.nickname || emp.name) : data.employee_id
    
    await logActivity(
        'kpi_change', 
        data.created_by || 'Admin', 
        targetName, 
        `KPI Point: ${data.points > 0 ? '+' : ''}${data.points} points added (${data.category})`
      )

    return result
  }
  return null
}

export async function deleteEmployeeKPI(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('employee_kpis')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error("ERROR (deleteEmployeeKPI):", error)
      return false
    }
    return true
  }
  return false
}

// ========== MONTHLY TARGETS ==========

export async function getMonthlyTarget(month: string): Promise<MonthlyTarget | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('monthly_targets')
      .select('*')
      .eq('month', month)
      .single()
    
    if (!error && data) return data
    
    // Auto-generate if not exists
    return calculateAutoTarget(month)
  }
  return null
}

export async function upsertMonthlyTarget(target: Omit<MonthlyTarget, 'id'>): Promise<MonthlyTarget | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('monthly_targets')
      .upsert(target, { onConflict: 'month' })
      .select()
      .single()
    
    if (error) {
      console.error("ERROR (upsertMonthlyTarget):", error)
      return null
    }
    return data
  }
  return null
}

async function calculateAutoTarget(month: string): Promise<MonthlyTarget | null> {
  return null
}

// ========== FINANCIAL ANALYTICS ==========

export async function getFinancialSummary(month: string): Promise<FinancialSummary> {
  const [year, monthNum] = month.split('-')
  const startDate = `${month}-01`
  const endDate = getLocalYYYYMMDD(new Date(parseInt(year), parseInt(monthNum), 0))
  
  // For queries requiring full ISO timestamps (like sales_logs)
  const startDateISO = `${startDate}T00:00:00.000Z`
  const endDateISO = `${endDate}T23:59:59.999Z`

  if (isSupabaseConfigured()) {
    // 1. Revenue & COGS from sales_logs
    const { data: salesData } = await supabase
      .from('sales_logs')
      .select('total_price, total_cost, created_at')
      .gte('created_at', startDateISO)
      .lte('created_at', endDateISO)
    
    const revenue = (salesData || []).reduce((sum, s) => sum + s.total_price, 0)
    const cogs = (salesData || []).reduce((sum, s) => sum + (s.total_cost || 0), 0)
    
    // 2. OPEX from monthly_opex
    const opexData = await getMonthlyOpex(month)
    const opex = opexData
      .filter(o => o.category !== 'Staff Payroll (Locked)')
      .reduce((sum, o) => sum + o.amount, 0)
    
    // Check for locked payroll in OPEX table
    const lockedPayroll = opexData.find(o => o.category === 'Staff Payroll (Locked)')
    
    // 3. Waste from inventory_transactions
    const { data: wasteData } = await supabase
      .from('inventory_transactions')
      .select('quantity, item_id')
      .eq('type', 'waste')
      .gte('created_at', startDateISO)
      .lte('created_at', endDateISO)
    
    const inventory = await getInventory()
    const itemCostMap = new Map(inventory.map(i => [i.id, i.unit_cost || 0]))
    const waste = (wasteData || []).reduce((sum, w) => sum + (w.quantity * (itemCostMap.get(w.item_id) || 0)), 0)
    
    // 4. Payroll - Live Estimation or Locked Value
    let payrollCosts = 0
    let isPayrollLocked = false

    if (lockedPayroll) {
      payrollCosts = lockedPayroll.amount
      isPayrollLocked = true
    } else {
      // Fallback to Live Estimation if not locked
      const [attendanceRows, payrollRecords] = await Promise.all([
        getAttendanceReportData(startDate, endDate),
        getPayrolls(startDate, endDate)
      ])
      
      const empStats = new Map<string, { mins: number, rate: number, adj: number }>()
      const sortedPayrolls = [...payrollRecords].sort((a, b) => 
        new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime()
      )

      sortedPayrolls.forEach(p => {
        empStats.set(p.employee_id, { mins: 0, rate: p.salary_hourly || 0, adj: p.adjustment || 0 })
      })
      
      attendanceRows.forEach(row => {
        if (!empStats.has(row.employee_id)) {
          empStats.set(row.employee_id, { mins: 0, rate: 0, adj: 0 })
        }
        const stats = empStats.get(row.employee_id)!
        stats.mins += (row.regularMinutes || 0) + (row.overtimeMinutes || 0)
      })
      
      payrollCosts = Array.from(empStats.values()).reduce((sum, s) => {
        return sum + ((s.mins / 60) * s.rate) + s.adj
      }, 0)
    }
    
    // 5. Calculations
    const grossProfit = revenue - cogs
    const netProfit = grossProfit - opex - waste - payrollCosts
    const totalTransactions = (salesData || []).length
    const aov = totalTransactions > 0 ? revenue / totalTransactions : 0
    
    // 5. Sales per Hour
    const salesPerHour: Record<string, number> = {}
    for (const sale of salesData || []) {
      const hour = new Date(sale.created_at).getHours()
      const hourStr = `${hour}:00`
      salesPerHour[hourStr] = (salesPerHour[hourStr] || 0) + 1
    }
    
    return {
      revenue,
      cogs,
      grossProfit,
      opex,
      waste,
      payroll: payrollCosts,
      netProfit,
      totalTransactions,
      aov,
      salesPerHour
    }
  }

  // Fallback empty stats
  return {
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    opex: 0,
    waste: 0,
    payroll: 0,
    netProfit: 0,
    totalTransactions: 0,
    aov: 0,
    salesPerHour: {}
  }
}

// ========== SALES & BATCH INTEGRATION ==========

/**
 * Process a menu sale by deducting ingredients from batches using FIFO.
 * Calls the database RPC: process_menu_sales_fifo
 */
export async function processSale(menuIds: string[], quantities: number[], actorName: string = 'System'): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.rpc('process_menu_sales_fifo', {
      p_menu_ids: menuIds,
      p_quantities: quantities,
      p_actor_name: actorName
    })

    if (error) {
      console.error("ERROR (processSale):", error)
      return false
    }
    
    // Log activity
    await logActivity(
      'inventory_change',
      actorName,
      'Multiple Items',
      `Sale Recorded: ${menuIds.length} items sold.`
    )
    
    return true
  }
  return false
}

/**
 * Update the expiry date for all active batches of a specific item.
 * Typically called when the main inventory item's expiry date is updated.
 */
export async function updateBatchesExpiryByItem(itemId: string, newExpiry: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('inventory_batches')
      .update({ expired_date: newExpiry })
      .eq('item_id', itemId)
      .gt('remaining_quantity', 0) // Only update active batches

    if (error) {
      console.error("ERROR (updateBatchesExpiryByItem):", error)
      return false
    }
    return true
  }
  return false
}

