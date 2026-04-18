// DONOTDISTURB Coffee System - Complete Data

export interface Employee {
  id: string
  name: string
  nickname: string
  email: string
  password?: string
  nfc_uid: string | null
  shift: "morning" | "afternoon" | "evening"
  status: "active" | "inactive"
  avatar?: string
  role: "admin" | "barista"
  employment_type: "full-time" | "part-time"
}

export interface ShiftConfig {
  id: string
  name: string
  start_time: string // HH:MM
  end_time: string // HH:MM
}

export interface ShiftAssignment {
  id: string
  employeeId: string
  employeeName: string
  date: string // YYYY-MM-DD
  dayOfWeek: number // 0-6 (Sunday-Saturday)
  startTime: string // HH:MM
  endTime: string // HH:MM
  shiftConfigId?: string // Reference to predefined shift
}

export interface OvertimeRequest {
  id: string
  employeeId: string
  employeeName: string
  attendanceLogId: string
  requestDate: string
  clockInTime: string
  status: "pending" | "approved" | "rejected"
  reviewedBy?: string
  reviewedAt?: string
  notes?: string
}

export interface InventoryItem {
  id: string
  name: string
  category: "beans" | "milk" | "syrup" | "cups" | "food"
  unit: string
  currentStock: number
  minStock: number
  maxStock: number
  dailyUsage: number
  lastUpdated: string
  unitCost: number
}

export interface MenuItem {
  id: string
  name: string
  category: "coffee" | "non-coffee" | "food"
  price: number
  recipe?: Recipe
}

export interface Recipe {
  ingredients: { itemId: string; amount: number }[]
}

export interface Activity {
  id: string
  title: string
  description: string
  date: string
  image: string
  category: "workshop" | "event" | "cupping"
}

export interface GalleryImage {
  id: string
  src: string
  alt: string
  category: "interior" | "coffee" | "people" | "events"
}

export interface StockLog {
  id: string
  itemId: string
  itemName: string
  type: "in" | "out" | "waste" | "opname"
  amount: number
  employeeId: string
  employeeName: string
  timestamp: string
  notes?: string
  batchId?: string
}

// Batch Tracking Types
export type BatchStatus = "active" | "depleted" | "expired" | "quarantined"

export interface InventoryBatch {
  id: string
  inventoryItemId: string
  inventoryItemName: string
  batchNumber: string
  supplier: string
  receivedDate: string
  expiryDate: string
  initialQuantity: number
  currentQuantity: number
  unitCost: number
  status: BatchStatus
  notes?: string
  is_opened?: boolean
  opened_at?: string
  createdAt: string
  updatedAt: string
}

export interface BatchMovement {
  id: string
  batchId: string
  batchNumber: string
  inventoryItemId: string
  inventoryItemName: string
  type: "in" | "out" | "waste" | "adjustment" | "transfer"
  quantity: number
  employeeId: string
  employeeName: string
  reason?: string
  notes?: string
  timestamp: string
}

export interface AttendanceLog {
  id: string
  employeeId: string
  employeeName: string
  type: "clock-in" | "clock-out"
  timestamp: string
}

export interface SalesData {
  menuId: string
  menuName: string
  quantity: number
  date: string
}

export interface User {
  email: string
  password: string
  role: "admin" | "employee"
  employeeId?: string
}

// Background images for slider
export const heroBackgrounds = [
  "/images/hero-1.jpg",
  "/images/hero-2.jpg",
  "/images/hero-3.jpg",
  "/images/hero-4.jpg",
]

// Dummy Users for Authentication
export const users: User[] = [
  { email: "admin", password: "admin", role: "admin" },
  { email: "karyawan", password: "karyawan", role: "employee", employeeId: "emp-1" },
]

// Dummy Employees
export const employees: Employee[] = [
  {
    id: "emp-admin",
    name: "Administrator",
    nickname: "Admin",
    email: "admin",
    password: "admin",
    nfc_uid: null,
    shift: "morning",
    status: "active",
    role: "admin",
    employment_type: "full-time",
  },
  {
    id: "emp-1",
    name: "Bimo Arya Putra",
    nickname: "Bimo",
    email: "bimo@donotdisturb.coffee",
    password: "bimo123",
    nfc_uid: "A1B2C3D4",
    shift: "morning",
    status: "active",
    role: "barista",
    employment_type: "full-time",
  },
  {
    id: "emp-2",
    name: "Raka Mahendra",
    nickname: "Raka",
    email: "raka@donotdisturb.coffee",
    password: "raka123",
    nfc_uid: "E5F6G7H8",
    shift: "afternoon",
    status: "active",
    role: "barista",
    employment_type: "full-time",
  },
  {
    id: "emp-3",
    name: "Aditya Pratama",
    nickname: "Adit",
    email: "adit@donotdisturb.coffee",
    password: "adit123",
    nfc_uid: "I9J0K1L2",
    shift: "evening",
    status: "active",
    role: "barista",
    employment_type: "part-time",
  },
]

// Dummy Shift Assignments (for current week)
export const shiftAssignments: ShiftAssignment[] = [
  // Monday
  { id: "shift-1", employeeId: "emp-1", employeeName: "Bimo", date: "2026-03-16", dayOfWeek: 1, startTime: "06:00", endTime: "14:00" },
  { id: "shift-2", employeeId: "emp-2", employeeName: "Raka", date: "2026-03-16", dayOfWeek: 1, startTime: "13:00", endTime: "21:00" },
  // Tuesday
  { id: "shift-3", employeeId: "emp-1", employeeName: "Bimo", date: "2026-03-17", dayOfWeek: 2, startTime: "06:00", endTime: "14:00" },
  { id: "shift-4", employeeId: "emp-3", employeeName: "Adit", date: "2026-03-17", dayOfWeek: 2, startTime: "17:00", endTime: "23:00" },
  // Wednesday
  { id: "shift-5", employeeId: "emp-2", employeeName: "Raka", date: "2026-03-18", dayOfWeek: 3, startTime: "06:00", endTime: "14:00" },
  { id: "shift-6", employeeId: "emp-1", employeeName: "Bimo", date: "2026-03-18", dayOfWeek: 3, startTime: "13:00", endTime: "21:00" },
  // Thursday (today 2026-03-19)
  { id: "shift-7", employeeId: "emp-1", employeeName: "Bimo", date: "2026-03-19", dayOfWeek: 4, startTime: "06:00", endTime: "14:00" },
  { id: "shift-8", employeeId: "emp-2", employeeName: "Raka", date: "2026-03-19", dayOfWeek: 4, startTime: "13:00", endTime: "21:00" },
  { id: "shift-9", employeeId: "emp-3", employeeName: "Adit", date: "2026-03-19", dayOfWeek: 4, startTime: "17:00", endTime: "23:00" },
  // Friday
  { id: "shift-10", employeeId: "emp-1", employeeName: "Bimo", date: "2026-03-20", dayOfWeek: 5, startTime: "06:00", endTime: "14:00" },
  { id: "shift-11", employeeId: "emp-2", employeeName: "Raka", date: "2026-03-20", dayOfWeek: 5, startTime: "13:00", endTime: "21:00" },
]

// Dummy Overtime Requests
export const overtimeRequests: OvertimeRequest[] = []

// Dummy Inventory
export const inventory: InventoryItem[] = [
  // Beans (grams)
  {
    id: "beans-1",
    name: "Flores Bajawa",
    category: "beans",
    unit: "g",
    currentStock: 2300,
    minStock: 500,
    maxStock: 5000,
    dailyUsage: 600,
    lastUpdated: "2026-03-15T08:00:00Z",
    unitCost: 0.35,
  },
  {
    id: "beans-2",
    name: "Ethiopia Guji",
    category: "beans",
    unit: "g",
    currentStock: 1800,
    minStock: 500,
    maxStock: 5000,
    dailyUsage: 450,
    lastUpdated: "2026-03-15T08:00:00Z",
    unitCost: 0.45,
  },
  {
    id: "beans-3",
    name: "Colombia Huila",
    category: "beans",
    unit: "g",
    currentStock: 3200,
    minStock: 500,
    maxStock: 5000,
    dailyUsage: 400,
    lastUpdated: "2026-03-15T08:00:00Z",
    unitCost: 0.40,
  },
  // Milk (liters)
  {
    id: "milk-1",
    name: "Fresh Milk",
    category: "milk",
    unit: "L",
    currentStock: 12,
    minStock: 5,
    maxStock: 30,
    dailyUsage: 5.2,
    lastUpdated: "2026-03-15T08:00:00Z",
    unitCost: 25000,
  },
  {
    id: "milk-2",
    name: "Oat Milk",
    category: "milk",
    unit: "L",
    currentStock: 8,
    minStock: 3,
    maxStock: 20,
    dailyUsage: 2.5,
    lastUpdated: "2026-03-15T08:00:00Z",
    unitCost: 45000,
  },
  // Syrup (bottles)
  {
    id: "syrup-1",
    name: "Vanilla Syrup",
    category: "syrup",
    unit: "bottle",
    currentStock: 4,
    minStock: 2,
    maxStock: 10,
    dailyUsage: 0.3,
    lastUpdated: "2026-03-15T08:00:00Z",
    unitCost: 85000,
  },
  {
    id: "syrup-2",
    name: "Caramel Syrup",
    category: "syrup",
    unit: "bottle",
    currentStock: 3,
    minStock: 2,
    maxStock: 10,
    dailyUsage: 0.4,
    lastUpdated: "2026-03-15T08:00:00Z",
    unitCost: 85000,
  },
  // Cups (pcs)
  {
    id: "cups-1",
    name: "Paper Cup 8oz",
    category: "cups",
    unit: "pcs",
    currentStock: 450,
    minStock: 100,
    maxStock: 1000,
    dailyUsage: 80,
    lastUpdated: "2026-03-15T08:00:00Z",
    unitCost: 1500,
  },
  {
    id: "cups-2",
    name: "Paper Cup 12oz",
    category: "cups",
    unit: "pcs",
    currentStock: 380,
    minStock: 100,
    maxStock: 1000,
    dailyUsage: 60,
    lastUpdated: "2026-03-15T08:00:00Z",
    unitCost: 2000,
  },
  // Food items
  {
    id: "food-1",
    name: "Croissant",
    category: "food",
    unit: "pcs",
    currentStock: 12,
    minStock: 5,
    maxStock: 30,
    dailyUsage: 8,
    lastUpdated: "2026-03-15T08:00:00Z",
    unitCost: 15000,
  },
  {
    id: "food-2",
    name: "Banana Bread",
    category: "food",
    unit: "pcs",
    currentStock: 8,
    minStock: 3,
    maxStock: 20,
    dailyUsage: 5,
    lastUpdated: "2026-03-15T08:00:00Z",
    unitCost: 12000,
  },
]

// Dummy Menu Items
export const menuItems: MenuItem[] = [
  {
    id: "menu-1",
    name: "Espresso",
    category: "coffee",
    price: 25000,
    recipe: {
      ingredients: [{ itemId: "beans-1", amount: 18 }],
    },
  },
  {
    id: "menu-2",
    name: "Americano",
    category: "coffee",
    price: 28000,
    recipe: {
      ingredients: [{ itemId: "beans-1", amount: 18 }],
    },
  },
  {
    id: "menu-3",
    name: "Cappuccino",
    category: "coffee",
    price: 35000,
    recipe: {
      ingredients: [
        { itemId: "beans-1", amount: 18 },
        { itemId: "milk-1", amount: 0.15 },
      ],
    },
  },
  {
    id: "menu-4",
    name: "Latte",
    category: "coffee",
    price: 38000,
    recipe: {
      ingredients: [
        { itemId: "beans-2", amount: 18 },
        { itemId: "milk-1", amount: 0.2 },
      ],
    },
  },
  {
    id: "menu-5",
    name: "Vanilla Latte",
    category: "coffee",
    price: 42000,
    recipe: {
      ingredients: [
        { itemId: "beans-2", amount: 18 },
        { itemId: "milk-1", amount: 0.2 },
        { itemId: "syrup-1", amount: 0.02 },
      ],
    },
  },
  {
    id: "menu-6",
    name: "Manual Brew V60",
    category: "coffee",
    price: 35000,
    recipe: {
      ingredients: [{ itemId: "beans-3", amount: 20 }],
    },
  },
  {
    id: "menu-7",
    name: "Oat Latte",
    category: "coffee",
    price: 45000,
    recipe: {
      ingredients: [
        { itemId: "beans-2", amount: 18 },
        { itemId: "milk-2", amount: 0.2 },
      ],
    },
  },
  {
    id: "menu-8",
    name: "Croissant",
    category: "food",
    price: 25000,
  },
  {
    id: "menu-9",
    name: "Banana Bread",
    category: "food",
    price: 22000,
  },
]

// Dummy Activities
export const activities: Activity[] = [
  {
    id: "act-1",
    title: "Latte Art Workshop",
    description: "Learn the fundamentals of latte art with our head barista. Perfect for beginners and enthusiasts alike.",
    date: "2026-03-20",
    image: "/images/activities/latte-art.jpg",
    category: "workshop",
  },
  {
    id: "act-2",
    title: "Coffee Cupping Session",
    description: "Explore the flavor profiles of single-origin coffees from Indonesia and beyond.",
    date: "2026-03-25",
    image: "/images/activities/cupping.jpg",
    category: "cupping",
  },
  {
    id: "act-3",
    title: "Brewing Methods 101",
    description: "Master V60, Aeropress, and French Press techniques in this hands-on workshop.",
    date: "2026-04-05",
    image: "/images/activities/brewing.jpg",
    category: "workshop",
  },
  {
    id: "act-4",
    title: "Coffee & Jazz Night",
    description: "An evening of live jazz music paired with our finest single-origin espresso.",
    date: "2026-04-10",
    image: "/images/activities/jazz-night.jpg",
    category: "event",
  },
]

// Dummy Gallery Images
export const galleryImages: GalleryImage[] = [
  { id: "g1", src: "/images/gallery/interior-1.jpg", alt: "Coffee bar interior", category: "interior" },
  { id: "g2", src: "/images/gallery/coffee-1.jpg", alt: "Latte art", category: "coffee" },
  { id: "g3", src: "/images/gallery/people-1.jpg", alt: "Barista at work", category: "people" },
  { id: "g4", src: "/images/gallery/events-1.jpg", alt: "Workshop session", category: "events" },
  { id: "g5", src: "/images/gallery/interior-2.jpg", alt: "Seating area", category: "interior" },
  { id: "g6", src: "/images/gallery/coffee-2.jpg", alt: "Pour over brewing", category: "coffee" },
  { id: "g7", src: "/images/gallery/people-2.jpg", alt: "Customer enjoying coffee", category: "people" },
  { id: "g8", src: "/images/gallery/events-2.jpg", alt: "Cupping session", category: "events" },
  { id: "g9", src: "/images/gallery/coffee-3.jpg", alt: "Espresso extraction", category: "coffee" },
  { id: "g10", src: "/images/gallery/interior-3.jpg", alt: "Coffee beans display", category: "interior" },
  { id: "g11", src: "/images/gallery/people-3.jpg", alt: "Team photo", category: "people" },
  { id: "g12", src: "/images/gallery/coffee-4.jpg", alt: "Coffee and pastry", category: "coffee" },
]

// Shift Configurations (predefined shifts)
export const shiftConfigs: ShiftConfig[] = [
  {
    id: "shift-config-1",
    name: "Shift 1 (Morning)",
    start_time: "06:00",
    end_time: "14:00",
  },
  {
    id: "shift-config-2",
    name: "Shift 2 (Afternoon)",
    start_time: "14:00",
    end_time: "22:00",
  },
  {
    id: "shift-config-3",
    name: "Shift 3 (Evening)",
    start_time: "17:00",
    end_time: "23:00",
  },
]

// Community Events
export const communityEvents = [
  {
    id: "ce-1",
    title: "Weekly Coffee Meetup",
    description: "Join fellow coffee enthusiasts every Saturday for casual conversations and coffee tasting.",
    schedule: "Every Saturday, 10:00 AM",
    image: "/images/community/meetup.jpg",
  },
  {
    id: "ce-2",
    title: "Barista Training Program",
    description: "A 4-week intensive program for aspiring baristas. Learn from industry professionals.",
    schedule: "Monthly, Starting first Monday",
    image: "/images/community/training.jpg",
  },
  {
    id: "ce-3",
    title: "Coffee Farmers Talk",
    description: "Meet the farmers behind your favorite beans. Direct trade stories and Q&A sessions.",
    schedule: "Bi-monthly",
    image: "/images/community/farmers.jpg",
  },
]

// Shop Info
export const shopInfo = {
  name: "DONOTDISTURB",
  tagline: "Specialty Coffee & Creative Space",
  address: "Jl. Senopati No. 42, Jakarta Selatan",
  phone: "+62 21 1234 5678",
  email: "hello@donotdisturb.coffee",
  hours: {
    weekday: "07:00 - 22:00",
    weekend: "08:00 - 23:00",
  },
  social: {
    instagram: "@donotdisturb.coffee",
    twitter: "@dndcoffee",
  },
}

// Simulated Sales Data (last 7 days)
export const salesData: SalesData[] = [
  // Day 1
  { menuId: "menu-4", menuName: "Latte", quantity: 120, date: "2026-03-09" },
  { menuId: "menu-3", menuName: "Cappuccino", quantity: 60, date: "2026-03-09" },
  { menuId: "menu-2", menuName: "Americano", quantity: 45, date: "2026-03-09" },
  { menuId: "menu-5", menuName: "Vanilla Latte", quantity: 35, date: "2026-03-09" },
  { menuId: "menu-6", menuName: "Manual Brew V60", quantity: 25, date: "2026-03-09" },
  // Day 2
  { menuId: "menu-4", menuName: "Latte", quantity: 115, date: "2026-03-10" },
  { menuId: "menu-3", menuName: "Cappuccino", quantity: 55, date: "2026-03-10" },
  { menuId: "menu-2", menuName: "Americano", quantity: 50, date: "2026-03-10" },
  { menuId: "menu-5", menuName: "Vanilla Latte", quantity: 40, date: "2026-03-10" },
  { menuId: "menu-6", menuName: "Manual Brew V60", quantity: 20, date: "2026-03-10" },
  // Day 3
  { menuId: "menu-4", menuName: "Latte", quantity: 130, date: "2026-03-11" },
  { menuId: "menu-3", menuName: "Cappuccino", quantity: 65, date: "2026-03-11" },
  { menuId: "menu-2", menuName: "Americano", quantity: 42, date: "2026-03-11" },
  { menuId: "menu-5", menuName: "Vanilla Latte", quantity: 38, date: "2026-03-11" },
  { menuId: "menu-6", menuName: "Manual Brew V60", quantity: 28, date: "2026-03-11" },
  // Day 4
  { menuId: "menu-4", menuName: "Latte", quantity: 118, date: "2026-03-12" },
  { menuId: "menu-3", menuName: "Cappuccino", quantity: 58, date: "2026-03-12" },
  { menuId: "menu-2", menuName: "Americano", quantity: 48, date: "2026-03-12" },
  { menuId: "menu-5", menuName: "Vanilla Latte", quantity: 42, date: "2026-03-12" },
  { menuId: "menu-6", menuName: "Manual Brew V60", quantity: 22, date: "2026-03-12" },
  // Day 5
  { menuId: "menu-4", menuName: "Latte", quantity: 125, date: "2026-03-13" },
  { menuId: "menu-3", menuName: "Cappuccino", quantity: 62, date: "2026-03-13" },
  { menuId: "menu-2", menuName: "Americano", quantity: 44, date: "2026-03-13" },
  { menuId: "menu-5", menuName: "Vanilla Latte", quantity: 36, date: "2026-03-13" },
  { menuId: "menu-6", menuName: "Manual Brew V60", quantity: 26, date: "2026-03-13" },
  // Day 6
  { menuId: "menu-4", menuName: "Latte", quantity: 140, date: "2026-03-14" },
  { menuId: "menu-3", menuName: "Cappuccino", quantity: 70, date: "2026-03-14" },
  { menuId: "menu-2", menuName: "Americano", quantity: 52, date: "2026-03-14" },
  { menuId: "menu-5", menuName: "Vanilla Latte", quantity: 45, date: "2026-03-14" },
  { menuId: "menu-6", menuName: "Manual Brew V60", quantity: 30, date: "2026-03-14" },
  // Day 7 (today)
  { menuId: "menu-4", menuName: "Latte", quantity: 120, date: "2026-03-15" },
  { menuId: "menu-3", menuName: "Cappuccino", quantity: 60, date: "2026-03-15" },
  { menuId: "menu-2", menuName: "Americano", quantity: 45, date: "2026-03-15" },
  { menuId: "menu-5", menuName: "Vanilla Latte", quantity: 38, date: "2026-03-15" },
  { menuId: "menu-6", menuName: "Manual Brew V60", quantity: 25, date: "2026-03-15" },
]

// Simulated Stock Logs
export const stockLogs: StockLog[] = [
  {
    id: "log-1",
    itemId: "beans-1",
    itemName: "Flores Bajawa",
    type: "in",
    amount: 1000,
    employeeId: "emp-1",
    employeeName: "Bimo",
    timestamp: "2026-03-14T08:30:00Z",
    notes: "Weekly delivery",
  },
  {
    id: "log-2",
    itemId: "milk-1",
    itemName: "Fresh Milk",
    type: "in",
    amount: 10,
    employeeId: "emp-1",
    employeeName: "Bimo",
    timestamp: "2026-03-14T08:35:00Z",
    notes: "Daily delivery",
  },
  {
    id: "log-3",
    itemId: "beans-1",
    itemName: "Flores Bajawa",
    type: "waste",
    amount: 50,
    employeeId: "emp-2",
    employeeName: "Raka",
    timestamp: "2026-03-14T14:20:00Z",
    notes: "Grinder calibration",
  },
  {
    id: "log-4",
    itemId: "milk-1",
    itemName: "Fresh Milk",
    type: "waste",
    amount: 0.5,
    employeeId: "emp-3",
    employeeName: "Adit",
    timestamp: "2026-03-14T18:00:00Z",
    notes: "Expired",
  },
  {
    id: "log-5",
    itemId: "cups-1",
    itemName: "Paper Cup 8oz",
    type: "in",
    amount: 200,
    employeeId: "emp-1",
    employeeName: "Bimo",
    timestamp: "2026-03-15T08:00:00Z",
    notes: "Restock",
  },
]

// Inventory Batches
export const inventoryBatches: InventoryBatch[] = [
  // Flores Bajawa batches
  {
    id: "batch-1",
    inventoryItemId: "beans-1",
    inventoryItemName: "Flores Bajawa",
    batchNumber: "FB-2026-001",
    supplier: "Flores Coffee Collective",
    receivedDate: "2026-03-01",
    expiryDate: "2026-09-01",
    initialQuantity: 2000,
    currentQuantity: 800,
    unitCost: 0.35,
    status: "active",
    notes: "Direct trade - single origin",
    createdAt: "2026-03-01T08:00:00Z",
    updatedAt: "2026-03-20T14:00:00Z",
  },
  {
    id: "batch-2",
    inventoryItemId: "beans-1",
    inventoryItemName: "Flores Bajawa",
    batchNumber: "FB-2026-002",
    supplier: "Flores Coffee Collective",
    receivedDate: "2026-03-15",
    expiryDate: "2026-09-15",
    initialQuantity: 2000,
    currentQuantity: 1500,
    unitCost: 0.36,
    status: "active",
    notes: "New harvest batch",
    createdAt: "2026-03-15T08:00:00Z",
    updatedAt: "2026-03-20T10:00:00Z",
  },
  // Ethiopia Guji batches
  {
    id: "batch-3",
    inventoryItemId: "beans-2",
    inventoryItemName: "Ethiopia Guji",
    batchNumber: "EG-2026-001",
    supplier: "Ethiopian Coffee Export",
    receivedDate: "2026-02-20",
    expiryDate: "2026-08-20",
    initialQuantity: 1500,
    currentQuantity: 300,
    unitCost: 0.45,
    status: "active",
    notes: "Natural process",
    createdAt: "2026-02-20T08:00:00Z",
    updatedAt: "2026-03-18T16:00:00Z",
  },
  {
    id: "batch-4",
    inventoryItemId: "beans-2",
    inventoryItemName: "Ethiopia Guji",
    batchNumber: "EG-2026-002",
    supplier: "Ethiopian Coffee Export",
    receivedDate: "2026-03-10",
    expiryDate: "2026-09-10",
    initialQuantity: 2000,
    currentQuantity: 1500,
    unitCost: 0.46,
    status: "active",
    notes: "Washed process",
    createdAt: "2026-03-10T08:00:00Z",
    updatedAt: "2026-03-19T12:00:00Z",
  },
  // Fresh Milk batches
  {
    id: "batch-5",
    inventoryItemId: "milk-1",
    inventoryItemName: "Fresh Milk",
    batchNumber: "FM-2026-0320",
    supplier: "Greenfields Dairy",
    receivedDate: "2026-03-20",
    expiryDate: "2026-03-27",
    initialQuantity: 15,
    currentQuantity: 12,
    unitCost: 25000,
    status: "active",
    notes: "Morning delivery",
    createdAt: "2026-03-20T06:00:00Z",
    updatedAt: "2026-03-23T08:00:00Z",
  },
  {
    id: "batch-6",
    inventoryItemId: "milk-1",
    inventoryItemName: "Fresh Milk",
    batchNumber: "FM-2026-0318",
    supplier: "Greenfields Dairy",
    receivedDate: "2026-03-18",
    expiryDate: "2026-03-25",
    initialQuantity: 15,
    currentQuantity: 0,
    unitCost: 25000,
    status: "depleted",
    notes: "Fully consumed",
    createdAt: "2026-03-18T06:00:00Z",
    updatedAt: "2026-03-21T18:00:00Z",
  },
  // Oat Milk batch
  {
    id: "batch-7",
    inventoryItemId: "milk-2",
    inventoryItemName: "Oat Milk",
    batchNumber: "OM-2026-003",
    supplier: "Oatly Indonesia",
    receivedDate: "2026-03-15",
    expiryDate: "2026-06-15",
    initialQuantity: 10,
    currentQuantity: 8,
    unitCost: 45000,
    status: "active",
    createdAt: "2026-03-15T08:00:00Z",
    updatedAt: "2026-03-22T14:00:00Z",
  },
  // Vanilla Syrup batch
  {
    id: "batch-8",
    inventoryItemId: "syrup-1",
    inventoryItemName: "Vanilla Syrup",
    batchNumber: "VS-2026-001",
    supplier: "Monin Indonesia",
    receivedDate: "2026-02-01",
    expiryDate: "2027-02-01",
    initialQuantity: 6,
    currentQuantity: 4,
    unitCost: 85000,
    status: "active",
    createdAt: "2026-02-01T08:00:00Z",
    updatedAt: "2026-03-20T10:00:00Z",
  },
  // Expired batch example
  {
    id: "batch-9",
    inventoryItemId: "milk-1",
    inventoryItemName: "Fresh Milk",
    batchNumber: "FM-2026-0310",
    supplier: "Greenfields Dairy",
    receivedDate: "2026-03-10",
    expiryDate: "2026-03-17",
    initialQuantity: 10,
    currentQuantity: 0.5,
    unitCost: 24000,
    status: "expired",
    notes: "Disposed - past expiry",
    createdAt: "2026-03-10T06:00:00Z",
    updatedAt: "2026-03-18T08:00:00Z",
  },
  // Paper Cups batch
  {
    id: "batch-10",
    inventoryItemId: "cups-1",
    inventoryItemName: "Paper Cup 8oz",
    batchNumber: "PC8-2026-002",
    supplier: "Packaging Supply Co",
    receivedDate: "2026-03-15",
    expiryDate: "2027-03-15",
    initialQuantity: 500,
    currentQuantity: 450,
    unitCost: 1500,
    status: "active",
    createdAt: "2026-03-15T08:00:00Z",
    updatedAt: "2026-03-22T16:00:00Z",
  },
]

// Batch Movements
export const batchMovements: BatchMovement[] = [
  {
    id: "bm-1",
    batchId: "batch-1",
    batchNumber: "FB-2026-001",
    inventoryItemId: "beans-1",
    inventoryItemName: "Flores Bajawa",
    type: "in",
    quantity: 2000,
    employeeId: "emp-1",
    employeeName: "Bimo",
    reason: "Initial stock",
    timestamp: "2026-03-01T08:00:00Z",
  },
  {
    id: "bm-2",
    batchId: "batch-1",
    batchNumber: "FB-2026-001",
    inventoryItemId: "beans-1",
    inventoryItemName: "Flores Bajawa",
    type: "out",
    quantity: 600,
    employeeId: "emp-2",
    employeeName: "Raka",
    reason: "Daily operations",
    timestamp: "2026-03-10T18:00:00Z",
  },
  {
    id: "bm-3",
    batchId: "batch-1",
    batchNumber: "FB-2026-001",
    inventoryItemId: "beans-1",
    inventoryItemName: "Flores Bajawa",
    type: "waste",
    quantity: 50,
    employeeId: "emp-2",
    employeeName: "Raka",
    reason: "Grinder calibration",
    notes: "Machine adjustment waste",
    timestamp: "2026-03-14T14:20:00Z",
  },
  {
    id: "bm-4",
    batchId: "batch-5",
    batchNumber: "FM-2026-0320",
    inventoryItemId: "milk-1",
    inventoryItemName: "Fresh Milk",
    type: "in",
    quantity: 15,
    employeeId: "emp-1",
    employeeName: "Bimo",
    reason: "Morning delivery",
    timestamp: "2026-03-20T06:00:00Z",
  },
  {
    id: "bm-5",
    batchId: "batch-5",
    batchNumber: "FM-2026-0320",
    inventoryItemId: "milk-1",
    inventoryItemName: "Fresh Milk",
    type: "out",
    quantity: 3,
    employeeId: "emp-3",
    employeeName: "Adit",
    reason: "Daily operations",
    timestamp: "2026-03-23T08:00:00Z",
  },
  {
    id: "bm-6",
    batchId: "batch-9",
    batchNumber: "FM-2026-0310",
    inventoryItemId: "milk-1",
    inventoryItemName: "Fresh Milk",
    type: "waste",
    quantity: 0.5,
    employeeId: "emp-1",
    employeeName: "Bimo",
    reason: "Expired",
    notes: "Past expiry date - disposed",
    timestamp: "2026-03-18T08:00:00Z",
  },
]

// Simulated Attendance Logs
export const attendanceLogs: AttendanceLog[] = [
  { id: "att-1", employeeId: "emp-1", employeeName: "Bimo", type: "clock-in", timestamp: "2026-03-15T06:55:00Z" },
  { id: "att-2", employeeId: "emp-2", employeeName: "Raka", type: "clock-in", timestamp: "2026-03-15T12:58:00Z" },
  { id: "att-3", employeeId: "emp-1", employeeName: "Bimo", type: "clock-out", timestamp: "2026-03-15T15:02:00Z" },
  { id: "att-4", employeeId: "emp-3", employeeName: "Adit", type: "clock-in", timestamp: "2026-03-15T17:55:00Z" },
  { id: "att-5", employeeId: "emp-2", employeeName: "Raka", type: "clock-out", timestamp: "2026-03-15T21:05:00Z" },
]

// Helper functions
export function getStockHealth(item: InventoryItem): "healthy" | "warning" | "critical" {
  const daysRemaining = item.currentStock / item.dailyUsage
  if (daysRemaining <= 1) return "critical"
  if (daysRemaining <= 3) return "warning"
  return "healthy"
}

export function getDaysRemaining(item: InventoryItem): number {
  return Math.round((item.currentStock / item.dailyUsage) * 10) / 10
}

export function getOverallStockHealth(): number {
  const healthyItems = inventory.filter((item) => getStockHealth(item) === "healthy").length
  return Math.round((healthyItems / inventory.length) * 100)
}

export function getLowStockItems(): (InventoryItem & { daysRemaining: number })[] {
  return inventory
    .map((item) => ({ ...item, daysRemaining: getDaysRemaining(item) }))
    .filter((item) => item.daysRemaining <= 5)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
}

export function getOperationalCapacity(): number {
  const criticalItems = inventory.filter((item) => getStockHealth(item) === "critical")
  if (criticalItems.length > 0) return 1
  
  const minDays = Math.min(...inventory.map((item) => getDaysRemaining(item)))
  return Math.round(minDays * 10) / 10
}

export function getPurchaseRecommendations(): { item: InventoryItem; recommendedQty: number; coverageDays: number }[] {
  return inventory
    .filter((item) => getDaysRemaining(item) <= 7)
    .map((item) => {
      const coverageDays = 7
      const recommendedQty = Math.ceil(item.dailyUsage * coverageDays)
      return { item, recommendedQty, coverageDays }
    })
    .sort((a, b) => getDaysRemaining(a.item) - getDaysRemaining(b.item))
}

export function getIngredientUsageFromSales(date: string): { itemId: string; itemName: string; usage: number }[] {
  const daySales = salesData.filter((s) => s.date === date)
  const usageMap: Record<string, { itemName: string; usage: number }> = {}

  daySales.forEach((sale) => {
    const menu = menuItems.find((m) => m.id === sale.menuId)
    if (!menu?.recipe) return

    menu.recipe.ingredients.forEach((ing) => {
      const item = inventory.find((i) => i.id === ing.itemId)
      if (!item) return

      if (!usageMap[ing.itemId]) {
        usageMap[ing.itemId] = { itemName: item.name, usage: 0 }
      }
      usageMap[ing.itemId].usage += ing.amount * sale.quantity
    })
  })

  return Object.entries(usageMap).map(([itemId, data]) => ({
    itemId,
    itemName: data.itemName,
    usage: Math.round(data.usage * 100) / 100,
  }))
}

export function getWasteTrend(): { date: string; total: number }[] {
  const wasteLogs = stockLogs.filter((log) => log.type === "waste")
  const grouped: Record<string, number> = {}

  wasteLogs.forEach((log) => {
    const date = log.timestamp.split("T")[0]
    grouped[date] = (grouped[date] || 0) + log.amount
  })

  return Object.entries(grouped)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function getTodayAttendance(): AttendanceLog[] {
  const today = "2026-03-15"
  return attendanceLogs.filter((log) => log.timestamp.startsWith(today))
}

export function getOnShiftEmployees(): Employee[] {
  const todayLogs = getTodayAttendance()
  const clockedIn = new Set<string>()

  todayLogs.forEach((log) => {
    if (log.type === "clock-in") {
      clockedIn.add(log.employeeId)
    } else {
      clockedIn.delete(log.employeeId)
    }
  })

  return employees.filter((emp) => clockedIn.has(emp.id))
}

export function findEmployeeByNFC(nfcUid: string): Employee | undefined {
  return employees.find((emp) => emp.nfc_uid === nfcUid)
}

export function authenticateUser(email: string, password: string): User | null {
  const user = users.find((u) => u.email === email && u.password === password)
  return user || null
}

// Batch Tracking Helper Functions
export function getBatchesByInventoryItem(inventoryItemId: string): InventoryBatch[] {
  return inventoryBatches.filter((batch) => batch.inventoryItemId === inventoryItemId)
}

export function getActiveBatches(): InventoryBatch[] {
  return inventoryBatches.filter((batch) => batch.status === "active")
}

export function getExpiringBatches(daysThreshold: number = 7): InventoryBatch[] {
  const today = new Date()
  const thresholdDate = new Date(today.getTime() + daysThreshold * 24 * 60 * 60 * 1000)
  
  return inventoryBatches
    .filter((batch) => {
      if (batch.status !== "active") return false
      const expiryDate = new Date(batch.expiryDate)
      return expiryDate <= thresholdDate
    })
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
}

export function getExpiredBatches(): InventoryBatch[] {
  const today = new Date()
  return inventoryBatches.filter((batch) => {
    const expiryDate = new Date(batch.expiryDate)
    return expiryDate < today && batch.status !== "depleted"
  })
}

export function getBatchMovements(batchId: string): BatchMovement[] {
  return batchMovements
    .filter((movement) => movement.batchId === batchId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export function getBatchStatus(batch: InventoryBatch): BatchStatus {
  const today = new Date()
  const expiryDate = new Date(batch.expiryDate)
  
  if (batch.currentQuantity <= 0) return "depleted"
  if (expiryDate < today) return "expired"
  if (batch.status === "quarantined") return "quarantined"
  return "active"
}

export function getDaysUntilExpiry(expiryDate: string): number {
  const today = new Date()
  const expiry = new Date(expiryDate)
  const diffTime = expiry.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function getOldestBatchForItem(inventoryItemId: string): InventoryBatch | undefined {
  return inventoryBatches
    .filter((batch) => batch.inventoryItemId === inventoryItemId && batch.status === "active" && batch.currentQuantity > 0)
    .sort((a, b) => new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime())[0]
}

export function getTotalBatchQuantity(inventoryItemId: string): number {
  return inventoryBatches
    .filter((batch) => batch.inventoryItemId === inventoryItemId && batch.status === "active")
    .reduce((sum, batch) => sum + batch.currentQuantity, 0)
}

export function getBatchValueByItem(inventoryItemId: string): number {
  return inventoryBatches
    .filter((batch) => batch.inventoryItemId === inventoryItemId && batch.status === "active")
    .reduce((sum, batch) => sum + batch.currentQuantity * batch.unitCost, 0)
}
