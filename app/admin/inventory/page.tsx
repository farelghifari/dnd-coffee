"use client"

import { useState, useEffect } from "react"
import { 
  getInventory, 
  upsertInventory,
  deleteInventoryItem,
  getStockHealth,
  getDaysRemaining,
  addBatch,
  stockOutManual,
  getMenuItems,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  saveMenuRecipes,
  getMenuRecipes,
  getMonthlyOpex,
  addMonthlyOpex,
  deleteMonthlyOpex,
  addStock,
  getInventoryOpnames,
  addInventoryOpname,
  uploadOpexAttachment,
  getSalesReport,
  openBatch,
  calculateRollingDailyUsage,
  subscribeToInventoryTransactions,
  subscribeToInventoryItems,
  toBaseUnit,
  fromBaseUnit,
  getConversionRate,
  getAllowedUnitsForItem,
  getDefaultDisplayUnit,
  getBatches,
  updateBatch,
  getBatchesByItem,
  type InventoryItem,
  type InventoryBatch,
  type MenuItem,
  type MenuRecipeIngredient,
  type MonthlyOpex,
  type InventoryOpname,
  type DisplayUnit,
  type SalesReport
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Package, 
  Search, 
  Plus,
  Filter,
  Pencil,
  Trash2,
  MoreVertical,
  PackagePlus,
  PackageOpen,
  ArrowDownCircle,
  Coffee,
  AlertTriangle,
  ChevronRight,
  Calculator,
  Calendar,
  History,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  Upload,
  ArrowRightLeft,
  X
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"

const DEFAULT_CATEGORIES = ["beans", "milk", "syrup", "cups", "food", "other"]
const unitOptions: DisplayUnit[] = ["gram", "ml", "pcs", "kg", "liter"]
const menuCategories = ["all", "coffee", "non-coffee", "food"] as const

export default function InventoryPage() {
  const { user, isSuperAdmin } = useAuth()
  const canEdit = isSuperAdmin()
  const actorName = user?.name || user?.nickname || "System"
  
  const [activeTab, setActiveTab] = useState("raw-materials")
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [filteredMenu, setFilteredMenu] = useState<MenuItem[]>([])
  const [monthlyOpex, setMonthlyOpex] = useState<MonthlyOpex[]>([])
  const [salesReport, setSalesReport] = useState<SalesReport[]>([])
  const [opnameHistory, setOpnameHistory] = useState<InventoryOpname[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [menuSearchQuery, setMenuSearchQuery] = useState("")
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>("all")
  const [batches, setBatches] = useState<InventoryBatch[]>([])
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [newCategoryInput, setNewCategoryInput] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Dynamic categories: merge defaults with categories found in existing data + user-added
  const allCategoryOptions = Array.from(new Set([
    ...DEFAULT_CATEGORIES,
    ...inventory.map(i => i.category).filter(Boolean),
    ...customCategories
  ])).sort()
  const inventoryCategories = ["all", ...allCategoryOptions]

  // Modals
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false)
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false)
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false)
  const [isStockOutModalOpen, setIsStockOutModalOpen] = useState(false)
  const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState(false)
  const [isEditMenuModalOpen, setIsEditMenuModalOpen] = useState(false)
  const [isAddOpexModalOpen, setIsAddOpexModalOpen] = useState(false)
  const [isRecordOpnameModalOpen, setIsRecordOpnameModalOpen] = useState(false)
  
  // Custom Delete Alert State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, type: 'item' | 'menu' | null, id: string | null}>({ isOpen: false, type: null, id: null })

  // Forms
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    category: "beans",
    unit: "gram",
    displayUnit: "gram" as DisplayUnit,
    currentStock: "",
    dailyUsage: "",
    minStock: "",
    maxStock: "",
    unitCost: "",
    conversionRate: "1",
    supplierName: "",
    notes: "",
    receivedDate: new Date().toISOString().split("T")[0],
    expiryDate: ""
  })

  const [rollingUsage, setRollingUsage] = useState<number | null>(null)
  const [isCalculatingUsage, setIsCalculatingUsage] = useState(false)

  const [stockInForm, setStockInForm] = useState({
    category: "all" as string,
    itemId: "",
    quantity: "",
    displayUnit: "pcs" as DisplayUnit,
    unitCost: "",
    supplierName: "",
    receivedDate: new Date().toISOString().split("T")[0],
    expiredDate: "",
    notes: "",
    is_opened: false
  })

  const [stockOutForm, setStockOutForm] = useState({
    category: "all" as string,
    itemId: "",
    quantity: "",
    displayUnit: "pcs" as DisplayUnit,
    reason: ""
  })

  const [menuForm, setMenuForm] = useState({
    id: "",
    name: "",
    category: "coffee" as "coffee" | "non-coffee" | "food",
    price: "",
    packaging_cost: "0",
    ingredients: [] as MenuRecipeIngredient[]
  })

  const [opexForm, setOpexForm] = useState({
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
    category: "Salary",
    amount: "",
    notes: ""
  })
  const [opexFile, setOpexFile] = useState<File | null>(null)

  const [opnameForm, setOpnameForm] = useState({
    category: "all" as string,
    itemId: "",
    actualStock: "",
    displayUnit: "pcs" as DisplayUnit,
    theoreticalStock: 0 as number,
    reason: ""
  })

  const opexCategories = ["Salary", "Rent", "Utilities", "Tax", "Marketing", "Maintenance", "Other"]

  useEffect(() => {
    fetchData()

    const unsubscribeTransactions = subscribeToInventoryTransactions(() => fetchData())
    const unsubscribeInventory = subscribeToInventoryItems(() => fetchData())

    return () => {
      unsubscribeTransactions()
      unsubscribeInventory()
    }
  }, [])

  useEffect(() => {
    let result = inventory

    if (selectedCategory !== "all") {
      result = result.filter(item => item.category === selectedCategory)
    }

    if (searchQuery) {
      result = result.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    setFilteredInventory(result)
  }, [inventory, searchQuery, selectedCategory])

  useEffect(() => {
    let result = menuItems

    if (selectedMenuCategory !== "all") {
      result = result.filter(item => item.category === selectedMenuCategory)
    }

    if (menuSearchQuery) {
      result = result.filter(item => 
        item.name.toLowerCase().includes(menuSearchQuery.toLowerCase())
      )
    }

    setFilteredMenu(result)
  }, [menuItems, menuSearchQuery, selectedMenuCategory])

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [invData, menuData, opexData, opnameData, salesData, batchData] = await Promise.all([
        getInventory(),
        getMenuItems(),
        getMonthlyOpex(),
        getInventoryOpnames(),
        getSalesReport(),
        getBatches()
      ])
      
      const menusWithRecipes = await Promise.all(
        menuData.map(async (menu: any) => {
          const recipe = await getMenuRecipes(menu.id)
          return { 
            ...menu, 
            type: menu.type || menu.category || 'coffee',
            recipe: { ingredients: recipe || [] } 
          } as MenuItem
        })
      )
      
      setInventory(invData)
      setMenuItems(menusWithRecipes)
      setMonthlyOpex(opexData)
      setSalesReport(salesData)
      setOpnameHistory(opnameData)
      setBatches(batchData)
    } catch (err) {
      console.error("Error fetching data:", err)
      setError("Failed to load inventory data")
    } finally {
      setIsLoading(false)
    }
  }

  const resetItemForm = () => {
    setFormData({
      id: "",
      name: "",
      category: "beans",
      unit: "gram",
      displayUnit: "gram",
      currentStock: "",
      dailyUsage: "",
      minStock: "",
      maxStock: "",
      unitCost: "",
      conversionRate: "1",
      supplierName: "",
      notes: "",
      receivedDate: new Date().toISOString().split("T")[0],
      expiryDate: ""
    })
    setRollingUsage(null)
    setIsCalculatingUsage(false)
    setError(null)
  }

  const resetMenuForm = () => {
    setMenuForm({
      id: "",
      name: "",
      category: "coffee",
      price: "",
      packaging_cost: "0",
      ingredients: []
    })
    setError(null)
  }

  const handleAddItem = async () => {
    if (!formData.name || !formData.currentStock) return
    
    try {
      const multiplier = parseFloat(formData.conversionRate) || 
                         getConversionRate(formData.displayUnit, formData.unit) || 
                         1
      
      const stockVal = (parseFloat(formData.currentStock) || 0) * multiplier
      const minVal = (parseFloat(formData.minStock) || 0) * multiplier
      const maxVal = (parseFloat(formData.maxStock) || 0) * multiplier
      const dailyVal = (parseFloat(formData.dailyUsage) || 0) * multiplier
      const normalizedCost = (parseFloat(formData.unitCost) || 0) / multiplier
      
      const resultItem = await upsertInventory({
        name: formData.name,
        category: formData.category as any,
        unit: formData.unit,
        display_unit: formData.displayUnit,
        conversion_rate: multiplier,
        stock: 0, // IMPORTANT: Let addBatch handle the initial stock to avoid doubling
        min_stock: minVal,
        max_stock: maxVal,
        daily_usage: dailyVal,
        unit_cost: normalizedCost,
        supplier_name: formData.supplierName,
        notes: formData.notes
      }, actorName)

      // Automatically add the first batch if currentStock is provided
      if (stockVal > 0 && resultItem?.id) {
        await addBatch({
          item_id: resultItem.id, 
          quantity: stockVal,
          unit: formData.unit as any,
          unit_cost: normalizedCost,
          supplier_name: formData.supplierName,
          received_date: formData.receivedDate,
          expired_date: formData.expiryDate,
          notes: "Initial stock",
          is_opened: true // First batch is always opened
        }, actorName)
      }
      
      setIsAddItemModalOpen(false)
      resetItemForm()
      fetchData()
    } catch (err) {
      setError("Failed to add inventory item")
    }
  }

  const handleEditItem = async () => {
    if (!formData.id || !formData.name || !formData.currentStock) return
    
    try {
      const multiplier = parseFloat(formData.conversionRate) || 
                       getConversionRate(formData.displayUnit, formData.unit) || 
                       1
    const stockVal = (parseFloat(formData.currentStock) || 0) * multiplier
      const minVal = (parseFloat(formData.minStock) || 0) * multiplier
      const maxVal = (parseFloat(formData.maxStock) || 0) * multiplier
      const dailyVal = (parseFloat(formData.dailyUsage) || 0) * multiplier
      const normalizedCost = (parseFloat(formData.unitCost) || 0) / multiplier

      await upsertInventory({
        id: formData.id,
        name: formData.name,
        category: formData.category as any,
        unit: formData.unit,
        display_unit: formData.displayUnit,
        conversion_rate: multiplier,
        stock: stockVal,
        min_stock: minVal,
        max_stock: maxVal,
        daily_usage: dailyVal,
        unit_cost: normalizedCost,
        supplier_name: formData.supplierName,
        notes: formData.notes
      }, actorName)

      // Update primary batch dates if they exist, or create one if missing
      try {
        const itemBatches = await getBatchesByItem(formData.id)
        if (itemBatches.length > 0) {
          const primaryBatch = itemBatches[0]
          await updateBatch(primaryBatch.id, {
            supplier_name: formData.supplierName,
            received_date: formData.receivedDate,
            expired_date: formData.expiryDate
          })
        } else if (stockVal > 0) {
          // SELF-HEALING: If no batch exists for this item, create one now
          await addBatch({
            item_id: formData.id,
            quantity: stockVal,
            unit: formData.unit as any,
            unit_cost: normalizedCost,
            supplier_name: formData.supplierName,
            received_date: formData.receivedDate,
            expired_date: formData.expiryDate,
            notes: "Repaired from edit form",
            is_opened: true
          }, actorName)
        }
      } catch (e) {
        console.error("Failed to sync batch info:", e)
      }
      
      setIsEditItemModalOpen(false)
      resetItemForm()
      fetchData()
    } catch (err) {
      setError("Failed to update inventory item")
    }
  }

  const openEditItemModal = async (item: InventoryItem) => {
    // Priority 1: Stored display_unit from DB
    // Priority 2: Standard default derived from system unit
    // Priority 3: The system unit itself
    const dUnit = (item.display_unit || getDefaultDisplayUnit(item.unit) || item.unit) as DisplayUnit
    
    // Priority 1: Stored conversion_rate from DB (if not the default 1 or if units are the same)
    // Priority 2: Standard conversion rate based on units
    // Priority 3: Fallback 1
    let multiplier = item.conversion_rate || 1
    if (multiplier === 1 && dUnit.toLowerCase() !== item.unit.toLowerCase()) {
      multiplier = getConversionRate(dUnit, item.unit)
    }
    
    // Auto-calculate daily usage from rolling average
    setIsCalculatingUsage(true)
    let calculatedUsage = 0
    try {
      const usage = await calculateRollingDailyUsage(item.id)
      calculatedUsage = usage / multiplier
      setRollingUsage(calculatedUsage)
    } catch (e) {
      console.error(e)
      setRollingUsage(null)
    } finally {
      setIsCalculatingUsage(false)
    }

    // Fetch batch info to get expiry/received dates
    let batchReceivedDate = new Date().toISOString().split("T")[0]
    let batchExpiryDate = ""
    try {
      const itemBatches = await getBatchesByItem(item.id)
      if (itemBatches.length > 0) {
        // Get dates from the oldest batch (first one created)
        const primaryBatch = itemBatches[0]
        if (primaryBatch.received_date) {
          batchReceivedDate = new Date(primaryBatch.received_date).toISOString().split("T")[0]
        }
        if (primaryBatch.expired_date) {
          batchExpiryDate = new Date(primaryBatch.expired_date).toISOString().split("T")[0]
        }
      }
    } catch (e) {
      console.error("Failed to fetch batch info:", e)
    }

    setFormData({
      id: item.id,
      name: item.name,
      category: item.category as any,
      unit: item.unit,
      displayUnit: dUnit,
      conversionRate: multiplier.toString(),
      currentStock: parseFloat(((item.stock || 0) / multiplier).toFixed(4)).toString(),
      dailyUsage: calculatedUsage.toString(),
      minStock: parseFloat(((item.min_stock || 0) / multiplier).toFixed(4)).toString(),
      maxStock: parseFloat(((item.max_stock || 0) / multiplier).toFixed(4)).toString(),
      unitCost: parseFloat(((item.unit_cost || 0) * multiplier).toFixed(4)).toString(),
      supplierName: item.supplier_name || "",
      notes: item.notes || "",
      receivedDate: batchReceivedDate,
      expiryDate: batchExpiryDate
    })

    setIsEditItemModalOpen(true)
  }

  const handleOpenBatch = async (batchId: string) => {
    try {
      await openBatch(batchId)
      fetchData()
      // Also re-fetch batches if they aren't part of fetchData
      const updatedBatches = await getBatches()
      setBatches(updatedBatches)
    } catch (err) {
      setError("Failed to open batch")
    }
  }

  const handleDeleteItem = async (id: string) => {
    setDeleteConfirm({ isOpen: true, type: 'item', id })
  }

  const trulyDeleteItem = async (id: string) => {
    try {
      await deleteInventoryItem(id)
      fetchData()
    } catch (err) {
      setError("Failed to delete item")
    }
  }

  // Stock In (Purchase/Stock Add)
  const handleStockIn = async () => {
    if (!stockInForm.itemId || !stockInForm.quantity || !stockInForm.unitCost) return
    
    try {
      const item = inventory.find(i => i.id === stockInForm.itemId)
      const multiplier = item?.conversion_rate || getConversionRate(stockInForm.displayUnit, item?.unit || 'pcs') || 1
      const baseQuantity = parseFloat(stockInForm.quantity) * multiplier
      
      const normalizedCost = (parseFloat(stockInForm.unitCost) || 0) / multiplier
      
      await addBatch({
        item_id: stockInForm.itemId,
        quantity: baseQuantity,
        unit: stockInForm.displayUnit,
        unit_cost: normalizedCost,
        supplier_name: stockInForm.supplierName,
        received_date: stockInForm.receivedDate,
        expired_date: stockInForm.expiredDate,
        notes: stockInForm.notes
      }, actorName)
      
      setIsAddStockModalOpen(false)
      setStockInForm({ 
        category: "all",
        itemId: "", 
        quantity: "", 
        displayUnit: "pcs", 
        unitCost: "", 
        supplierName: "", 
        receivedDate: new Date().toISOString().split("T")[0], 
        expiredDate: "", 
        notes: "",
        is_opened: false 
      })
      fetchData()
    } catch (err) {
      setError("Failed to add stock")
    }
  }

  // Stock Out (Manual Waste/Damage)
  const handleStockOutManual = async () => {
    if (!stockOutForm.itemId || !stockOutForm.quantity) return
    
    try {
      const item = inventory.find(i => i.id === stockOutForm.itemId)
      const multiplier = item?.conversion_rate || getConversionRate(stockOutForm.displayUnit, item?.unit || 'pcs') || 1
      const baseQty = parseFloat(stockOutForm.quantity) * multiplier
      
      await stockOutManual(
        stockOutForm.itemId,
        baseQty,
        stockOutForm.reason,
        actorName
      )
      
      setIsStockOutModalOpen(false)
      setStockOutForm({ category: "all", itemId: "", quantity: "", displayUnit: "pcs", reason: "" })
      fetchData()
    } catch (err) {
      setError("Failed to remove stock")
    }
  }

  // Menu Handling
  const addIngredientRow = () => {
    setMenuForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { inventory_item_id: "", quantity: 0, unit: "pcs" as DisplayUnit }]
    }))
  }

  const removeIngredientRow = (index: number) => {
    setMenuForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }))
  }

  const updateIngredient = (index: number, field: string, value: any) => {
    setMenuForm(prev => {
      const newIngredients = [...prev.ingredients]
      if (field === 'inventory_item_id') {
        const item = inventory.find(i => i.id === value)
        newIngredients[index] = { 
          ...newIngredients[index], 
          [field]: value,
          unit: item ? getDefaultDisplayUnit(item.unit) : 'pcs' as DisplayUnit
        }
      } else {
        newIngredients[index] = { ...newIngredients[index], [field]: value }
      }
      return { ...prev, ingredients: newIngredients }
    })
  }

  const handleIngredientUnitChange = (index: number, newUnit: DisplayUnit) => {
    setMenuForm(prev => {
      const newIngredients = [...prev.ingredients];
      const oldUnit = newIngredients[index].unit;
      const qty = parseFloat(newIngredients[index].quantity.toString()) || 0;
      
      // Convert to base unit then to new display unit
      const baseQty = toBaseUnit(qty, oldUnit || 'pcs');
      const newQty = fromBaseUnit(baseQty, newUnit);
      
      newIngredients[index] = {
        ...newIngredients[index],
        unit: newUnit,
        quantity: parseFloat(newQty.toFixed(4))
      };
      return { ...prev, ingredients: newIngredients };
    });
  };

  const menuCOGS = menuForm.ingredients.reduce((acc, ing) => {
    const invItem = inventory.find(i => i.id === ing.inventory_item_id);
    if (!invItem) return acc;
    const baseQty = toBaseUnit(ing.quantity || 0, ing.unit || 'pcs');
    return acc + (invItem.unit_cost || 0) * baseQty;
  }, 0);

  const handleAddMenu = async () => {
    if (!menuForm.name || !menuForm.price) return
    try {
      const newMenu = await addMenuItem({
        name: menuForm.name,
        type: menuForm.category,
        price: parseFloat(menuForm.price),
        packaging_cost: parseFloat(menuForm.packaging_cost) || 0,
        status: 'active'
      })
      
      if (newMenu && menuForm.ingredients.length > 0) {
        // Convert quantities to base unit (g/ml) for DB
        const baseIngredients = menuForm.ingredients.map(ing => ({
          inventory_item_id: ing.inventory_item_id,
          quantity: toBaseUnit(ing.quantity, ing.unit || 'pcs' as DisplayUnit),
          unit: ing.unit || 'pcs'
        }))
        await saveMenuRecipes(newMenu.id, baseIngredients)
      }
      
      setIsAddMenuModalOpen(false)
      resetMenuForm()
      fetchData()
    } catch (err) {
      setError("Failed to add menu item")
    }
  }

  const handleEditMenu = async () => {
    if (!menuForm.id || !menuForm.name || !menuForm.price) return
    try {
      await updateMenuItem(menuForm.id, {
        name: menuForm.name,
        type: menuForm.category,
        price: parseFloat(menuForm.price),
        packaging_cost: parseFloat(menuForm.packaging_cost) || 0
      })
      
      const baseIngredients = menuForm.ingredients.map(ing => ({
        inventory_item_id: ing.inventory_item_id,
        quantity: toBaseUnit(ing.quantity, ing.unit || 'pcs' as DisplayUnit),
        unit: ing.unit || 'pcs'
      }))
      await saveMenuRecipes(menuForm.id, baseIngredients)
      
      setIsEditMenuModalOpen(false)
      resetMenuForm()
      fetchData()
    } catch (err) {
      setError("Failed to update menu item")
    }
  }

  const openEditMenuModal = (item: MenuItem) => {
    setMenuForm({
      id: item.id,
      name: item.name,
      category: (item.type || item.category) as any,
      price: item.price.toString(),
      packaging_cost: (item.packaging_cost || 0).toString(),
      ingredients: (item.recipe?.ingredients || []).map(ing => {
        const invItem = inventory.find(iv => iv.id === ing.inventory_item_id)
        const dUnit = (ing.unit as DisplayUnit) || (invItem?.unit as DisplayUnit) || 'pcs'
        return {
          inventory_item_id: ing.inventory_item_id,
          unit: dUnit,
          quantity: parseFloat(fromBaseUnit(ing.quantity, dUnit).toFixed(4))
        }
      })
    })
    setIsEditMenuModalOpen(true)
  }

  const handleDeleteMenu = async (id: string) => {
    setDeleteConfirm({ isOpen: true, type: 'menu', id })
  }

  const trulyDeleteMenu = async (id: string) => {
    try {
      await deleteMenuItem(id)
      fetchData()
    } catch (err) {
      setError("Failed to delete menu item")
    }
  }

  // Monthly Opex / BOP Handling
  const handleAddOpex = async () => {
    if (!opexForm.amount) return
    try {
      let attachmentUrl = undefined
      if (opexFile) {
        attachmentUrl = await uploadOpexAttachment(opexFile) || undefined
      }

      await addMonthlyOpex({
        month: opexForm.month,
        category: opexForm.category,
        amount: parseFloat(opexForm.amount),
        notes: opexForm.notes,
        attachment_url: attachmentUrl
      })
      
      setIsAddOpexModalOpen(false)
      setOpexForm({ ...opexForm, amount: "", notes: "" })
      setOpexFile(null)
      fetchData()
    } catch (err) {
      setError("Failed to add operational expense")
    }
  }

  // Stock Opname Handling
  const handleAddOpname = async () => {
    if (!opnameForm.itemId || !opnameForm.actualStock) return
    
    try {
      const item = inventory.find(i => i.id === opnameForm.itemId)
      if (!item) return
      
      const theoretical = item.stock || 0
      // Use stored conversion_rate if matches display_unit, otherwise use global converter
      const multiplier = (item.display_unit === opnameForm.displayUnit && item.conversion_rate) ? 
        item.conversion_rate : 
        getConversionRate(opnameForm.displayUnit, item.unit);
        
      const actual = parseFloat(opnameForm.actualStock) * (multiplier || 1)
      
      await addInventoryOpname({
        item_id: opnameForm.itemId,
        theoretical_stock: theoretical,
        actual_stock: actual,
        difference: actual - theoretical,
        reason: opnameForm.reason,
        actor_name: actorName
      })
      
      setIsRecordOpnameModalOpen(false)
      setOpnameForm({ category: "all", itemId: "", actualStock: "", displayUnit: "pcs", theoreticalStock: 0, reason: "" })
      fetchData()
    } catch (err) {
      setError("Failed to record stock opname")
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(price)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Alert Dialog (Delete Confirmation) */}
      <AlertDialog open={deleteConfirm.isOpen} onOpenChange={(open) => setDeleteConfirm(prev => ({...prev, isOpen: open}))}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.type === 'item' ? "This will definitively delete this inventory item and affect existing recipes handling it." : "This menu item will be permanently deleted from the system."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              if (deleteConfirm.type === 'item' && deleteConfirm.id) trulyDeleteItem(deleteConfirm.id)
              else if (deleteConfirm.type === 'menu' && deleteConfirm.id) trulyDeleteMenu(deleteConfirm.id)
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="mb-8">
        <h1 className="text-3xl font-light tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">
          {canEdit ? "Manage raw materials and menu items" : "View inventory (Read Only)"}
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="raw-materials" className="gap-2">
            <Package className="w-4 h-4" />
            Raw Materials
          </TabsTrigger>
          <TabsTrigger value="menu-items" className="gap-2">
            <Coffee className="w-4 h-4" />
            Menu Items
          </TabsTrigger>
          <TabsTrigger value="overheads" className="gap-2">
            <Calculator className="w-4 h-4" />
            Overheads (BOP)
          </TabsTrigger>
          <TabsTrigger value="opname" className="gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Stock Take (Opname)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="raw-materials">
          {canEdit && (
            <div className="flex gap-2 mb-6">
              <Button className="rounded-sm" onClick={() => { setStockInForm({ category: "all", itemId: "", quantity: "", displayUnit: "pcs", unitCost: "", supplierName: "", receivedDate: new Date().toISOString().split("T")[0], expiredDate: "", notes: "", is_opened: false }); setIsAddStockModalOpen(true); }}>
                <PackagePlus className="w-4 h-4 mr-2" />
                Stock In
              </Button>
              <Button variant="outline" className="rounded-sm" onClick={() => { setStockOutForm({ category: "all", itemId: "", quantity: "", displayUnit: "pcs", reason: "" }); setIsStockOutModalOpen(true); }}>
                <ArrowDownCircle className="w-4 h-4 mr-2" />
                Waste / Stock Out
              </Button>
              <Button variant="outline" className="rounded-sm" onClick={() => { resetItemForm(); setIsAddItemModalOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search inventory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-sm"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              {inventoryCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    "px-4 py-1.5 rounded-sm text-sm capitalize whitespace-nowrap transition-colors",
                    selectedCategory === category
                      ? "bg-foreground text-background"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Stock Items ({filteredInventory.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground bg-card">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground bg-card">Category</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground bg-card">Current Stock</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground bg-card">Daily Usage</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground bg-card">Days Left</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground bg-card">Status</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground bg-card">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item) => {
                      const health = getStockHealth(item)
                      const daysRemaining = getDaysRemaining(item)

                      return (
                        <tr key={item.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                          <td className="py-4 px-4"><span className="font-medium">{item.name}</span></td>
                          <td className="py-4 px-4 text-sm text-muted-foreground capitalize">{item.category}</td>
                          <td className="py-4 px-4 text-right font-mono">
                            {(() => {
                              const dUnit = item.display_unit || getDefaultDisplayUnit(item.unit) || item.unit
                              let multiplier = item.conversion_rate || 1
                              if (multiplier === 1 && dUnit.toLowerCase() !== item.unit.toLowerCase()) {
                                multiplier = getConversionRate(dUnit, item.unit)
                              }
                              const val = (item.stock ?? 0) / multiplier
                              return `${parseFloat(val.toFixed(4))} ${dUnit}`
                            })()}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {(() => {
                              const dUnit = (item.display_unit || getDefaultDisplayUnit(item.unit) || item.unit) as DisplayUnit
                              let multiplier = item.conversion_rate || 1;
                              if (multiplier === 1 && dUnit.toLowerCase() !== item.unit.toLowerCase()) {
                                multiplier = getConversionRate(dUnit, item.unit);
                              }
                              const val = (item.daily_usage ?? 0) / multiplier
                              return `${parseFloat(val.toFixed(4))} ${dUnit}/day`
                            })()}
                          </td>
                          <td className="py-4 px-4 text-right font-mono">{daysRemaining}</td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn("inline-block px-3 py-1 rounded-sm text-xs font-medium capitalize", 
                              health === 'critical' ? 'bg-destructive/10 text-destructive' : 
                              health === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500')}>
                              {health}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {canEdit ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-1 hover:bg-muted rounded-sm"><MoreVertical className="w-4 h-4" /></button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-sm">
                                  <DropdownMenuItem onClick={() => openEditItemModal(item)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteItem(item.id)}><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : <span>-</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="menu-items">
          {/* Rule 3: Full Costing Insight Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="rounded-sm bg-primary/5 border-primary/20">
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Total Monthly Overhead (BOP)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatPrice(monthlyOpex.reduce((sum, o) => sum + o.amount, 0))}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Sum of all operational expenses</p>
              </CardContent>
            </Card>
            <Card className="rounded-sm bg-primary/5 border-primary/20">
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Total Items Sold</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{salesReport.reduce((sum, s) => sum + s.total_sold, 0)} Porsi</p>
                <p className="text-[10px] text-muted-foreground mt-1">Across all menu items</p>
              </CardContent>
            </Card>
            <Card className="rounded-sm bg-emerald-500/5 border-emerald-500/20">
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-semibold text-emerald-600 uppercase font-bold">Overhead Share per Portion</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatPrice(
                    salesReport.reduce((sum, s) => sum + s.total_sold, 0) > 0 
                      ? monthlyOpex.reduce((sum, o) => sum + o.amount, 0) / salesReport.reduce((sum, s) => sum + s.total_sold, 0)
                      : 0
                  )}
                </p>
                <p className="text-[10px] text-emerald-600/70 mt-1">Rule 3: (Total BOP / Total Sold)</p>
              </CardContent>
            </Card>
          </div>

          {canEdit && (
            <div className="flex gap-2 mb-6">
              <Button className="rounded-sm" onClick={() => { resetMenuForm(); setIsAddMenuModalOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />Add Menu
              </Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search menu..." value={menuSearchQuery} onChange={(e) => setMenuSearchQuery(e.target.value)} className="pl-9 rounded-sm" />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              {menuCategories.map((category) => (
                <button key={category} onClick={() => setSelectedMenuCategory(category)} className={cn("px-4 py-1.5 rounded-sm text-sm capitalize transition-colors", selectedMenuCategory === category ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground")}>
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMenu.map((item) => (
              <Card key={item.id} className="rounded-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{item.name}</CardTitle>
                      <p className="text-sm text-muted-foreground capitalize">{item.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-medium">{formatPrice(item.price)}</span>
                      {canEdit && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditMenuModal(item)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteMenu(item.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-secondary/20 rounded-sm border border-border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">COGS Breakdown</span>
                      <span className="text-xs font-mono text-primary font-bold">
                        {formatPrice(
                          (item.recipe?.ingredients?.reduce((acc: number, ing: MenuRecipeIngredient) => {
                            const invItem = inventory.find(i => i.id === ing.inventory_item_id);
                            return acc + (invItem?.unit_cost || 0) * ing.quantity;
                          }, 0) || 0) + (item.packaging_cost || 0)
                        )}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {item.recipe && item.recipe.ingredients.length > 0 ? (
                        item.recipe.ingredients.map((ing: MenuRecipeIngredient, idx: number) => {
                          const invItem = inventory.find(i => i.id === ing.inventory_item_id);
                          return (
                            <div key={idx} className="flex justify-between text-[11px]">
                              <span className="text-muted-foreground">{invItem?.name || "Unknown"} ({ing.quantity} {ing.unit || invItem?.unit})</span>
                              <span className="font-mono">{formatPrice((invItem?.unit_cost || 0) * ing.quantity)}</span>
                            </div>
                          );
                        })
                      ) : <div className="text-[11px] text-muted-foreground italic">No ingredients defined</div>}
                      <div className="flex justify-between text-[11px] pt-1 border-t border-border/40 mt-1">
                        <span className="text-muted-foreground">Packaging Cost</span>
                        <span className="font-mono">{formatPrice(item.packaging_cost || 0)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] pt-1 border-t border-dashed border-border/60 mt-1 bg-emerald-500/5 p-1 rounded-sm">
                        <span className="text-emerald-700 font-medium">Overhead Share (Rule 3)</span>
                        <span className="font-mono font-bold text-emerald-700">
                          +{formatPrice(
                            salesReport.reduce((sum, s) => sum + s.total_sold, 0) > 0 
                              ? monthlyOpex.reduce((sum, o) => sum + o.amount, 0) / salesReport.reduce((sum, s) => sum + s.total_sold, 0)
                              : 0
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">Total Full Cost</span>
                    <span className="text-sm font-bold font-mono">
                      {formatPrice(
                        (item.recipe?.ingredients?.reduce((acc: number, ing: MenuRecipeIngredient) => {
                          const invItem = inventory.find(i => i.id === ing.inventory_item_id);
                          return acc + (invItem?.unit_cost || 0) * ing.quantity;
                        }, 0) || 0) + 
                        (item.packaging_cost || 0) +
                        (salesReport.reduce((sum, s) => sum + s.total_sold, 0) > 0 
                          ? monthlyOpex.reduce((sum, o) => sum + o.amount, 0) / salesReport.reduce((sum, s) => sum + s.total_sold, 0)
                          : 0)
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="overheads">
          <div className="flex justify-between items-center mb-6">
            <Button className="rounded-sm" onClick={() => setIsAddOpexModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Add Overhead
            </Button>
            <Card className="bg-secondary/20 border-none">
              <CardContent className="p-4 flex items-center gap-4">
                <Calculator className="w-5 h-5" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Total Monthly BOP</p>
                  <p className="text-xl font-mono font-bold">{formatPrice(monthlyOpex.reduce((sum, item) => sum + (item.amount || 0), 0))}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-sm">
            <CardHeader><CardTitle>Operational Expense Logs</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Date</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Category</th>
                    <th className="text-right py-3 px-4 text-sm text-muted-foreground">Amount</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Notes/Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyOpex.map((opex) => (
                    <tr key={opex.id} className="border-b border-border">
                      <td className="py-4 px-4 text-xs">{new Date(opex.created_at).toLocaleDateString()}</td>
                      <td className="py-4 px-4"><span className="px-2 py-1 bg-secondary rounded text-[10px] uppercase">{opex.category}</span></td>
                      <td className="py-4 px-4 text-right font-mono">{formatPrice(opex.amount)}</td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          {opex.notes && <span className="text-xs">{opex.notes}</span>}
                          {opex.attachment_url && <a href={opex.attachment_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1"><ImageIcon className="w-3 h-3"/>View Receipt</a>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opname">
          <div className="flex justify-between items-center mb-6">
            <Button className="rounded-sm" onClick={() => setIsRecordOpnameModalOpen(true)}>
              <ClipboardCheck className="w-4 h-4 mr-2" />Start New Opname
            </Button>
          </div>

          <Card className="rounded-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><History className="w-5 h-5"/>History</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-muted-foreground">Date</th>
                    <th className="text-left py-3 px-4 text-muted-foreground">Item</th>
                    <th className="text-right py-3 px-4 text-muted-foreground">System</th>
                    <th className="text-right py-3 px-4 text-muted-foreground">Actual</th>
                    <th className="text-right py-3 px-4 text-muted-foreground">Waste</th>
                    <th className="text-left py-3 px-4 text-muted-foreground">Reason</th>
                  </tr>
                </thead>
                <tbody>
                    {opnameHistory.map((opname) => {
                      const item = inventory.find(i => i.id === opname.item_id);
                      const dUnit = (item?.display_unit || getDefaultDisplayUnit(item?.unit || 'pcs') || item?.unit || 'pcs') as DisplayUnit;
                      let multiplier = item?.conversion_rate || 1;
                      if (multiplier === 1 && dUnit.toLowerCase() !== (item?.unit || '').toLowerCase()) {
                        multiplier = getConversionRate(dUnit, item?.unit || 'pcs');
                      }
                      
                      return (
                        <tr key={opname.id} className="border-b border-border">
                          <td className="py-4 px-4 text-xs">{new Date(opname.created_at).toLocaleString()}</td>
                          <td className="py-4 px-4 font-medium">{item?.name || "Unknown"}</td>
                          <td className="py-4 px-4 text-right font-mono">{parseFloat(((opname.theoretical_stock || 0) / multiplier).toFixed(4))} {dUnit}</td>
                          <td className="py-4 px-4 text-right font-mono font-bold">{parseFloat(((opname.actual_stock || 0) / multiplier).toFixed(4))} {dUnit}</td>
                          <td className={`py-4 px-4 text-right font-mono font-bold ${opname.difference < 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                            {opname.difference > 0 ? '+' : ''}{parseFloat(((opname.difference || 0) / multiplier).toFixed(4))} {dUnit}
                          </td>
                          <td className="py-4 px-4 text-xs text-muted-foreground max-w-[150px] truncate" title={opname.reason || ""}>
                            {opname.reason || "-"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========== MODALS ========== */}
      
      {/* Add/Edit Item Modal */}
      <Dialog open={isAddItemModalOpen || isEditItemModalOpen} onOpenChange={(open) => { if (!open) { setIsAddItemModalOpen(false); setIsEditItemModalOpen(false); resetItemForm(); }}}>
        <DialogContent className="sm:max-w-[500px] rounded-sm">
          <DialogHeader>
            <DialogTitle>{isEditItemModalOpen ? "Edit" : "Add"} Inventory Item</DialogTitle>
            <DialogDescription>
              {isEditItemModalOpen ? "Modify the details of your inventory item." : "Create a new raw material item for your inventory."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label htmlFor="item-name">Item Name</Label>
              <Input id="item-name" placeholder="Item Name" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(v) => {
                  if (v === '__add_new__') return;
                  setFormData(p => ({ ...p, category: v as any }));
                }}>
                  <SelectTrigger id="category"><SelectValue placeholder="Category"/></SelectTrigger>
                  <SelectContent>
                    {allCategoryOptions.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    <div className="p-2 border-t">
                      <div className="flex gap-1">
                        <Input 
                          placeholder="New category..." 
                          value={newCategoryInput}
                          onChange={(e) => setNewCategoryInput(e.target.value)}
                          className="h-7 text-xs"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter' && newCategoryInput.trim()) {
                              const cat = newCategoryInput.trim().toLowerCase();
                              setCustomCategories(p => [...new Set([...p, cat])]);
                              setFormData(p => ({ ...p, category: cat as any }));
                              setNewCategoryInput("");
                            }
                          }}
                        />
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (newCategoryInput.trim()) {
                              const cat = newCategoryInput.trim().toLowerCase();
                              setCustomCategories(p => [...new Set([...p, cat])]);
                              setFormData(p => ({ ...p, category: cat as any }));
                              setNewCategoryInput("");
                            }
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Base Unit (System)</Label>
                <Select value={formData.unit} onValueChange={(v) => setFormData(p => ({ ...p, unit: v }))}>
                  <SelectTrigger id="unit"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gram">gram</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="pcs">pcs</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="liter">liter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="display-unit">Display Unit (Ops)</Label>
                <Input id="display-unit" placeholder="e.g., botol, pack, liter" value={formData.displayUnit} onChange={(e) => setFormData(p => ({ ...p, displayUnit: e.target.value as any }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conversion">Conversion Rate</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">1 {formData.displayUnit || 'item'} =</span>
                  <Input 
                    type="number" 
                    step="any"
                    className="h-8 w-24 p-2 rounded-sm" 
                    value={formData.conversionRate} 
                    onChange={(e) => {
                      const newRateStr = e.target.value;
                      const oldRate = parseFloat(formData.conversionRate) || 1;
                      const newRate = parseFloat(newRateStr) || 1;
                      
                      setFormData(p => ({ 
                        ...p, 
                        conversionRate: newRateStr,
                        currentStock: p.currentStock ? ((parseFloat(p.currentStock) * oldRate) / newRate).toFixed(4).replace(/\.?0+$/, "") : "",
                        dailyUsage: p.dailyUsage ? ((parseFloat(p.dailyUsage) * oldRate) / newRate).toFixed(4).replace(/\.?0+$/, "") : "",
                        minStock: p.minStock ? ((parseFloat(p.minStock) * oldRate) / newRate).toFixed(4).replace(/\.?0+$/, "") : "",
                        maxStock: p.maxStock ? ((parseFloat(p.maxStock) * oldRate) / newRate).toFixed(4).replace(/\.?0+$/, "") : "",
                        unitCost: p.unitCost ? ((parseFloat(p.unitCost) / oldRate) * newRate).toFixed(4).replace(/\.?0+$/, "") : ""
                      }))
                    }} 
                  />
                  <span className="text-xs text-muted-foreground">{formData.unit}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-[10px] text-primary p-0 h-auto font-bold" 
                  onClick={() => {
                    const rate = getConversionRate(formData.displayUnit, formData.unit);
                    setFormData(p => ({ ...p, conversionRate: rate.toString() }));
                  }}
                >
                  Reset to standard ({getConversionRate(formData.displayUnit, formData.unit)})
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="current-stock">Current Stock</Label>
                <Input id="current-stock" type="number" placeholder="0" value={formData.currentStock} onChange={(e) => setFormData(p => ({...p, currentStock: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="daily-usage">Daily Usage</Label>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Auto (7-day avg)</span>
                </div>
                <div className="relative">
                  <Input 
                    id="daily-usage" 
                    type="number" 
                    placeholder="0" 
                    value={isCalculatingUsage ? "" : formData.dailyUsage} 
                    readOnly 
                    className="bg-muted/50 cursor-not-allowed tabular-nums"
                  />
                  {isCalculatingUsage && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground animate-pulse">Calculating...</span>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground italic">Calculated automatically from the 7-day average sales</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="received-date">Received Date</Label>
                <Input id="received-date" type="date" value={formData.receivedDate} onChange={(e) => setFormData(p => ({ ...p, receivedDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry-date">Expiry Date</Label>
                <Input id="expiry-date" type="date" value={formData.expiryDate} onChange={(e) => setFormData(p => ({ ...p, expiryDate: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-name">Default Supplier</Label>
              <Input id="supplier-name" placeholder="Supplier Name" value={formData.supplierName} onChange={(e) => setFormData(p => ({ ...p, supplierName: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-notes">Notes</Label>
              <Textarea id="item-notes" placeholder="Notes/Storage info" value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-stock">Min Stock (Alert)</Label>
                <Input id="min-stock" type="number" placeholder="0" value={formData.minStock} onChange={(e) => setFormData(p => ({...p, minStock: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-stock">Max Stock (Capacity)</Label>
                <Input id="max-stock" type="number" placeholder="0" value={formData.maxStock} onChange={(e) => setFormData(p => ({...p, maxStock: e.target.value}))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-cost">Unit Cost (IDR)</Label>
              <div className="flex items-center gap-2">
                <Input id="unit-cost" type="number" step="any" placeholder="0" value={formData.unitCost} onChange={(e) => setFormData(p => ({...p, unitCost: e.target.value}))} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">per {formData.displayUnit || 'item'}</span>
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                {formData.displayUnit && formData.conversionRate && parseFloat(formData.conversionRate) > 1 ? 
                  `Equals ${formatPrice((parseFloat(formData.unitCost) || 0) / (parseFloat(formData.conversionRate) || 1))} per ${formData.unit}` : 
                  ""
                }
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={isEditItemModalOpen ? handleEditItem : handleAddItem}>{isEditItemModalOpen ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Stock In Modal */}
      <Dialog open={isAddStockModalOpen} onOpenChange={(open) => {
        setIsAddStockModalOpen(open);
        if (open) setStockInForm(p => ({ ...p, category: "all" }));
      }}>
        <DialogContent className="sm:max-w-[500px] rounded-sm">
          <DialogHeader>
            <DialogTitle>Stock In</DialogTitle>
            <DialogDescription>Record incoming stock for a specific item.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={stockInForm.category} onValueChange={(v) => {
                  setStockInForm(p => ({ ...p, category: v, itemId: "" }));
                }}>
                  <SelectTrigger className="rounded-sm"><SelectValue placeholder="All Categories"/></SelectTrigger>
                  <SelectContent>
                    {inventoryCategories.map(c => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c === "all" ? "All Categories" : c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Select Item</Label>
                <Select value={stockInForm.itemId} onValueChange={(v) => {
                  const item = inventory.find(i => i.id === v);
                  setStockInForm(p => ({ ...p, itemId: v, displayUnit: item ? getDefaultDisplayUnit(item.unit) : 'pcs' }));
                }}>
                  <SelectTrigger className="rounded-sm"><SelectValue placeholder="Select Item"/></SelectTrigger>
                  <SelectContent>
                    {inventory
                      .filter(i => stockInForm.category === "all" || i.category === stockInForm.category)
                      .map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" placeholder="0" value={stockInForm.quantity} onChange={(e) => setStockInForm(p => ({ ...p, quantity: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={stockInForm.displayUnit} onValueChange={(v) => setStockInForm(p => ({ ...p, displayUnit: v as DisplayUnit }))}>
                  <SelectTrigger className="rounded-sm font-semibold uppercase text-[10px]"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const item = inventory.find(i => i.id === stockInForm.itemId);
                      const base = item?.unit || 'pcs';
                      const units = getAllowedUnitsForItem(base);
                      if (item?.display_unit && !units.includes(item.display_unit as any)) {
                        units.push(item.display_unit as any);
                      }
                      return units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>);
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Unit Cost (IDR)</Label>
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="0" value={stockInForm.unitCost} onChange={(e) => setStockInForm(p => ({ ...p, unitCost: e.target.value }))} />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap uppercase font-bold">per {stockInForm.displayUnit}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Received Date</Label>
                <Input type="date" value={stockInForm.receivedDate} onChange={(e) => setStockInForm(p => ({ ...p, receivedDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date (Optional)</Label>
                <Input type="date" value={stockInForm.expiredDate} onChange={(e) => setStockInForm(p => ({ ...p, expiredDate: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Supplier Name</Label>
              <Input placeholder="Vendor name" value={stockInForm.supplierName} onChange={(e) => setStockInForm(p => ({ ...p, supplierName: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional details..." value={stockInForm.notes} onChange={(e) => setStockInForm(p => ({ ...p, notes: e.target.value }))} />
            </div>

            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="is-opened" 
                checked={stockInForm.is_opened || false} 
                onChange={(e) => setStockInForm(p => ({ ...p, is_opened: e.target.checked }))}
                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
              />
              <Label htmlFor="is-opened" className="text-sm font-medium leading-none cursor-pointer">
                Opened
              </Label>
            </div>
          </div>
          <DialogFooter><Button onClick={handleStockIn}>Stock In</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Out Modal */}
      <Dialog open={isStockOutModalOpen} onOpenChange={(open) => {
        setIsStockOutModalOpen(open);
        if (!open) setStockOutForm({ category: "all", itemId: "", quantity: "", displayUnit: "pcs", reason: "" });
      }}>
        <DialogContent className="sm:max-w-[425px] rounded-sm">
          <DialogHeader>
            <DialogTitle>Stock Out (Manual)</DialogTitle>
            <DialogDescription>Manually subtract stock for waste, damage, or other reasons.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={stockOutForm.category} onValueChange={(v) => {
                  setStockOutForm(p => ({ ...p, category: v, itemId: "" }));
                }}>
                  <SelectTrigger className="rounded-sm"><SelectValue placeholder="All Categories"/></SelectTrigger>
                  <SelectContent>
                    {inventoryCategories.map(c => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c === "all" ? "All Categories" : c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Select Item</Label>
                <Select value={stockOutForm.itemId} onValueChange={(v) => {
                  const item = inventory.find(i => i.id === v);
                  setStockOutForm(p => ({ ...p, itemId: v, displayUnit: item ? (item.display_unit as DisplayUnit || getDefaultDisplayUnit(item.unit)) : 'pcs' }));
                }}>
                  <SelectTrigger className="rounded-sm"><SelectValue placeholder="Select Item"/></SelectTrigger>
                  <SelectContent>
                    {inventory
                      .filter(i => stockOutForm.category === "all" || i.category === stockOutForm.category)
                      .map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" placeholder="0" value={stockOutForm.quantity} onChange={(e) => setStockOutForm(p => ({ ...p, quantity: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={stockOutForm.displayUnit} onValueChange={(v) => setStockOutForm(p => ({ ...p, displayUnit: v as DisplayUnit }))}>
                  <SelectTrigger className="rounded-sm font-semibold uppercase text-[10px]"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const item = inventory.find(i => i.id === stockOutForm.itemId);
                      const base = item?.unit || 'pcs';
                      const units = getAllowedUnitsForItem(base);
                      if (item?.display_unit && !units.includes(item.display_unit as any)) {
                        units.push(item.display_unit as any);
                      }
                      return units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>);
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {stockOutForm.itemId && (
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">FIFO Suggestions (Prioritize Opened)</Label>
                <div className="space-y-1">
                  {batches
                    .filter(b => b.item_id === stockOutForm.itemId && b.remaining_quantity > 0)
                    .sort((a, b) => {
                      // Sort by opened first, then by received date
                      if (a.is_opened && !b.is_opened) return -1;
                      if (!a.is_opened && b.is_opened) return 1;
                      return new Date(a.received_date).getTime() - new Date(b.received_date).getTime();
                    })
                    .slice(0, 3)
                    .map(b => (
                      <div key={b.id} className={cn("p-2 text-[10px] border rounded-sm flex items-center justify-between", b.is_opened ? "bg-amber-50 border-amber-200" : "bg-muted/30 border-border")}>
                        <div className="flex items-center gap-2">
                          {b.is_opened && <PackageOpen className="w-3 h-3 text-amber-600" />}
                          <span className="font-mono">{b.batch_number}</span>
                          <span className="text-muted-foreground">({b.remaining_quantity} {inventory.find(i => i.id === b.item_id)?.unit})</span>
                        </div>
                        {b.is_opened ? <span className="text-amber-600 font-bold">Opened</span> : <span className="text-muted-foreground">New</span>}
                      </div>
                    ))
                  }
                  {batches.filter(b => b.item_id === stockOutForm.itemId && b.remaining_quantity > 0).length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic">No active batches for this item</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Waste Category / Reason</Label>
              <Select value={stockOutForm.reason} onValueChange={(v) => setStockOutForm(p => ({ ...p, reason: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Spoiled/Expired">Spoiled / Expired</SelectItem>
                  <SelectItem value="Damaged">Damaged</SelectItem>
                  <SelectItem value="Operational Waste">Operational Waste</SelectItem>
                  <SelectItem value="Production Error">Production Error</SelectItem>
                  <SelectItem value="Shrinkage">Shrinkage / Susut</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="destructive" onClick={handleStockOutManual}>Confirm removal</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Menu Modal */}
      <Dialog open={isAddMenuModalOpen || isEditMenuModalOpen} onOpenChange={(o) => { if(!o) { setIsAddMenuModalOpen(false); setIsEditMenuModalOpen(false); resetMenuForm(); }}}>
        <DialogContent className="sm:max-w-[500px] rounded-sm">
          <DialogHeader>
            <DialogTitle>{isEditMenuModalOpen ? "Edit" : "Add"} Menu</DialogTitle>
            <DialogDescription>Define your menu item and its recipe ingredients.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>Menu Name</Label>
              <Input placeholder="Menu Item Name" value={menuForm.name} onChange={(e) => setMenuForm(p => ({ ...p, name: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={menuForm.category} onValueChange={(v) => setMenuForm(p => ({ ...p, category: v as any }))}>
                      <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="coffee">Coffee</SelectItem>
                        <SelectItem value="non-coffee">Non-Coffee</SelectItem>
                        <SelectItem value="food">Food</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Price (IDR)</Label>
                    <Input type="number" placeholder="0" value={menuForm.price} onChange={(e) => setMenuForm(p => ({ ...p, price: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Packaging Cost (IDR)</Label>
                  <Input type="number" placeholder="0" value={menuForm.packaging_cost} onChange={(e) => setMenuForm(p => ({ ...p, packaging_cost: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ingredients</Label>
              {menuForm.ingredients.map((ing, idx) => {
                const invItem = inventory.find(i => i.id === ing.inventory_item_id);
                const currentUnit = ing.unit || (invItem?.unit as DisplayUnit) || 'pcs';
                
                return (
                  <div key={idx} className="p-3 border rounded-sm bg-muted/30 space-y-3 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ingredient #{idx + 1}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeIngredientRow(idx)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Inventory Item</Label>
                        <Select value={ing.inventory_item_id} onValueChange={(v) => updateIngredient(idx, 'inventory_item_id', v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select item"/></SelectTrigger>
                          <SelectContent>{inventory.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Quantity & Unit</Label>
                        <div className="flex gap-1">
                          <Input className="h-9 flex-1" type="number" placeholder="0" value={ing.quantity} onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)} />
                          <Select value={currentUnit} onValueChange={(v) => handleIngredientUnitChange(idx, v as DisplayUnit)}>
                            <SelectTrigger className="h-9 w-[80px] text-[10px] font-bold uppercase [&>span]:truncate"><SelectValue/></SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const base = invItem?.unit || 'pcs';
                                const units = getAllowedUnitsForItem(base);
                                if (invItem?.display_unit && !units.includes(invItem.display_unit as any)) {
                                  units.push(invItem.display_unit as any);
                                }
                                return units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>);
                              })()}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    {invItem && (
                      <div className="flex justify-between items-center px-1 pt-1 border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground">
                          Cost: {formatPrice(invItem.unit_cost || 0)} / {invItem.unit}
                        </span>
                        <span className="text-[10px] font-bold text-primary">
                          Subtotal: {formatPrice((invItem.unit_cost || 0) * toBaseUnit(Number(ing.quantity) || 0, currentUnit))}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={addIngredientRow}><Plus className="w-4 h-4 mr-2"/>Add Ingredient</Button>
            </div>

              <div className="flex justify-between items-center p-3 rounded-sm bg-primary/10 border border-primary/20">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase font-bold">Estimated COGS</span>
                  <p className="text-[10px] text-muted-foreground">Recipe + Packaging</p>
                </div>
                <span className="text-lg font-bold text-primary">{formatPrice(menuCOGS + (parseFloat(menuForm.packaging_cost) || 0))}</span>
              </div>
          </div>
          <DialogFooter><Button onClick={isEditMenuModalOpen ? handleEditMenu : handleAddMenu}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Opname Modal */}
      <Dialog open={isRecordOpnameModalOpen} onOpenChange={(open) => {
        setIsRecordOpnameModalOpen(open);
        if (open) setOpnameForm(p => ({ ...p, category: "all" }));
      }}>
        <DialogContent className="sm:max-w-[425px] rounded-sm">
          <DialogHeader>
            <DialogTitle>Stock Take (Opname)</DialogTitle>
            <DialogDescription>Perform a physical stock count audit.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={opnameForm.category} onValueChange={(v) => {
                  setOpnameForm(p => ({ ...p, category: v, itemId: "" }));
                }}>
                  <SelectTrigger className="rounded-sm"><SelectValue placeholder="All Categories"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="beans">Beans</SelectItem>
                    <SelectItem value="milk">Milk</SelectItem>
                    <SelectItem value="syrup">Syrup</SelectItem>
                    <SelectItem value="cups">Cups</SelectItem>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Select Item</Label>
                <Select value={opnameForm.itemId} onValueChange={(v) => {
                  const item = inventory.find(i => i.id === v);
                  if (item) {
                    const dUnit = (item.display_unit as DisplayUnit) || getDefaultDisplayUnit(item.unit);
                    const theoretical = fromBaseUnit(item.stock, dUnit);
                    setOpnameForm(p => ({ 
                      ...p, 
                      itemId: v, 
                      displayUnit: dUnit, 
                      theoreticalStock: parseFloat(theoretical.toFixed(4)) 
                    }));
                  }
                }}>
                  <SelectTrigger className="rounded-sm w-full [&>span]:truncate"><SelectValue placeholder="Select Item"/></SelectTrigger>
                  <SelectContent>
                    {inventory
                      .filter(i => opnameForm.category === "all" || i.category === opnameForm.category)
                      .map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {opnameForm.itemId && (
              <div className="p-3 bg-muted/30 rounded-sm border border-border flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Expected (System)</span>
                    <span className="text-sm font-mono font-bold">{opnameForm.theoreticalStock} <span className="opacity-70 text-xs">{opnameForm.displayUnit}</span></span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Actual Result</span>
                    <span className="text-sm font-mono font-bold">{parseFloat(opnameForm.actualStock) || 0} <span className="opacity-70 text-xs">{opnameForm.displayUnit}</span></span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border flex justify-between items-center bg-background p-2 rounded-sm mt-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Difference (Waste)</span>
                  <span className={cn("text-base font-mono font-bold tracking-tight", (parseFloat(opnameForm.actualStock) || 0) - opnameForm.theoreticalStock < 0 ? "text-destructive" : "text-emerald-500")}>
                    {(parseFloat(opnameForm.actualStock) || 0) - opnameForm.theoreticalStock > 0 ? "+" : ""}
                    {(parseFloat(opnameForm.actualStock) || 0) - opnameForm.theoreticalStock} <span className="opacity-70 text-xs font-normal ml-1">{opnameForm.displayUnit}</span>
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Actual Physical Count</Label>
              <div className="flex gap-2">
                <Input 
                  type="number" 
                  placeholder="0" 
                  className="flex-1"
                  value={opnameForm.actualStock} 
                  onChange={(e) => setOpnameForm(p => ({ ...p, actualStock: e.target.value }))} 
                />
                <Select 
                  value={opnameForm.displayUnit} 
                  onValueChange={(v) => {
                    const item = inventory.find(i => i.id === opnameForm.itemId);
                    if (item) {
                      const newUnit = v as DisplayUnit;
                      const theoretical = fromBaseUnit(item.stock, newUnit);
                      setOpnameForm(p => ({ 
                        ...p, 
                        displayUnit: newUnit, 
                        theoreticalStock: parseFloat(theoretical.toFixed(4)) 
                      }));
                    }
                  }}
                >
                  <SelectTrigger className="w-[100px] rounded-sm font-semibold uppercase text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const item = inventory.find(i => i.id === opnameForm.itemId);
                      const base = item?.unit || 'pcs';
                      const units = getAllowedUnitsForItem(base);
                      // Add custom display unit if it's not in the standard list
                      if (item?.display_unit && !units.includes(item.display_unit as any)) {
                        units.push(item.display_unit as any);
                      }
                      return units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>);
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{(parseFloat(opnameForm.actualStock) || 0) < opnameForm.theoreticalStock ? 'Waste Category' : 'Notes / Reason'}</Label>
              {parseFloat(opnameForm.actualStock) < opnameForm.theoreticalStock ? (
                <Select value={opnameForm.reason} onValueChange={(v) => setOpnameForm(p => ({ ...p, reason: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select waste category..."/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Spoiled/Expired">Spoiled / Expired</SelectItem>
                    <SelectItem value="Damaged">Damaged</SelectItem>
                    <SelectItem value="Operational Waste">Operational Waste</SelectItem>
                    <SelectItem value="Production Error">Production Error</SelectItem>
                    <SelectItem value="Shrinkage">Shrinkage / Susut</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Textarea placeholder="Explain any discrepancies..." value={opnameForm.reason} onChange={(e) => setOpnameForm(p => ({ ...p, reason: e.target.value }))} />
              )}
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddOpname}>Record Audit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Overhead Modal */}
      <Dialog open={isAddOpexModalOpen} onOpenChange={setIsAddOpexModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-sm">
          <DialogHeader>
            <DialogTitle>Add Overhead</DialogTitle>
            <DialogDescription>Record monthly operational expenditures.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Month</Label>
              <Input type="month" value={opexForm.month} onChange={(e) => setOpexForm(p => ({...p, month: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={opexForm.category} onValueChange={(v) => setOpexForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{opexCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (IDR)</Label>
              <Input type="number" placeholder="0" value={opexForm.amount} onChange={(e) => setOpexForm(p => ({...p, amount: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Receipt Attachment</Label>
              <Input type="file" onChange={(e) => setOpexFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddOpex}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
