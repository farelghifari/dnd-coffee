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
  subscribeToInventoryTransactions,
  subscribeToInventoryItems,
  toBaseUnit,
  fromBaseUnit,
  getAllowedUnitsForItem,
  getDefaultDisplayUnit,
  type InventoryItem,
  type MenuItem,
  type MenuRecipeIngredient,
  type DisplayUnit
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
  Package, 
  Search, 
  Plus,
  Filter,
  Pencil,
  Trash2,
  MoreVertical,
  PackagePlus,
  ArrowDownCircle,
  Coffee,
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

const inventoryCategories = ["all", "beans", "milk", "syrup", "cups", "food"] as const
const categoryOptions = ["beans", "milk", "syrup", "cups", "food"] as const
// Standard unit options for inventory - these are the base units that define the item type
const unitOptions: DisplayUnit[] = ["gram", "ml", "pcs", "kg", "liter"]
const menuCategories = ["all", "coffee", "non-coffee", "food"] as const

export default function InventoryPage() {
  const { user, isSuperAdmin } = useAuth()
  const canEdit = isSuperAdmin()
  const actorName = user?.name || user?.nickname || "System"
  
  // Main data
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  
  // Tab state
  const [activeTab, setActiveTab] = useState("raw-materials")
  
  // Raw Materials filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<typeof inventoryCategories[number]>("all")
  
  // Menu filters
  const [menuSearchQuery, setMenuSearchQuery] = useState("")
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<typeof menuCategories[number]>("all")
  
  // Raw Materials modals
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false)
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false)
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false)
  const [isStockOutModalOpen, setIsStockOutModalOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  
  // Menu modals
  const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState(false)
  const [isEditMenuModalOpen, setIsEditMenuModalOpen] = useState(false)
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null)
  
  // Raw Materials form with display unit selection
  const [formData, setFormData] = useState({
    name: "",
    category: "food" as "beans" | "milk" | "syrup" | "cups" | "food",
    unit: "pcs" as string,
    displayUnit: "pcs" as DisplayUnit,
    currentStock: "",
    minStock: "",
    maxStock: "",
    dailyUsage: "",
    unitCost: ""
  })
  
  // Stock In form - creates batch entry (main stock entry point)
  const [stockInForm, setStockInForm] = useState({
    itemId: "",
    quantity: "",
    displayUnit: "pcs" as DisplayUnit,
    unitCost: "",
    supplierName: "",
    receivedDate: new Date().toISOString().split("T")[0],
    expiredDate: "",
    notes: ""
  })
  
  // Stock Out Manual form
  const [stockOutForm, setStockOutForm] = useState({
    itemId: "",
    quantity: "",
    displayUnit: "pcs" as DisplayUnit,
    reason: ""
  })
  
  // Menu form (with ingredients inline)
  const [menuForm, setMenuForm] = useState({
    name: "",
    category: "coffee" as "coffee" | "non-coffee" | "food",
    price: "",
    ingredients: [] as MenuRecipeIngredient[]
  })

  const fetchData = async () => {
    setIsLoading(true)
    const [inventoryData, menuData] = await Promise.all([
      getInventory(),
      getMenuItems()
    ])
    setInventory(inventoryData)
    setMenuItems(menuData)
    setIsLoading(false)
  }

  // STEP 4: Realtime subscriptions - update UI only, no full page reload
  // On change: update only affected row, NEVER reload page
  useEffect(() => {
    fetchData()
    
    // Subscribe to inventory_items changes - update only affected row
    const unsubInventoryItems = subscribeToInventoryItems((payload) => {
      if (payload?.new) {
        // Update or insert the affected item only
        setInventory(prev => {
          const newItem = (payload.new as unknown) as InventoryItem
          const existingIndex = prev.findIndex(item => item.id === newItem.id)
          if (existingIndex >= 0) {
            // Update existing item
            const updated = [...prev]
            updated[existingIndex] = { ...newItem, current_stock: newItem.stock }
            return updated
          } else {
            // Insert new item
            return [...prev, { ...newItem, current_stock: newItem.stock }]
          }
        })
      } else if (payload?.old && payload?.eventType === 'DELETE') {
        // Remove deleted item
        const oldItem = (payload.old as unknown) as InventoryItem
        setInventory(prev => prev.filter(item => item.id !== oldItem.id))
      } else {
        // Fallback: refetch all if payload is incomplete
        getInventory().then(setInventory)
      }
    })
    
    // Subscribe to inventory_transactions changes - refetch inventory to get updated stock
    const unsubInventoryTx = subscribeToInventoryTransactions(() => {
      // Transactions affect stock levels, so we need to refetch inventory
      getInventory().then(setInventory)
    })
    
    return () => {
      unsubInventoryItems()
      unsubInventoryTx()
    }
  }, [])

  // ========== RAW MATERIALS ==========
  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = (item.name || "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const getHealthBadge = (health: "healthy" | "warning" | "critical") => {
    const styles = {
      healthy: "bg-[var(--status-healthy)]/10 text-[var(--status-healthy)]",
      warning: "bg-[var(--status-warning)]/10 text-[var(--status-warning)]",
      critical: "bg-[var(--status-critical)]/10 text-[var(--status-critical)]",
    }
    return styles[health]
  }

  const resetItemForm = () => {
    setFormData({
      name: "",
      category: "food",
      unit: "pcs",
      displayUnit: "pcs",
      currentStock: "",
      minStock: "",
      maxStock: "",
      dailyUsage: "",
      unitCost: ""
    })
  }

  // INVENTORY FLOW: Add item using upsert_inventory()
  // Convert to base unit before saving (kg→gram, liter→ml)
  // CORE RULE: After success → REFRESH PAGE IMMEDIATELY
  const handleAddItem = async () => {
    if (!formData.name || !formData.currentStock) return
    setError("")
    
    // Convert display unit to base unit
    const stockInBaseUnit = toBaseUnit(
      parseFloat(formData.currentStock) || 0,
      formData.displayUnit
    )
    
    // Call upsert_inventory() - no id means insert
    const result = await upsertInventory({
      name: formData.name,
      category: formData.category,
      unit: formData.displayUnit, // Store display unit for reference
      stock: stockInBaseUnit,
      min_stock: parseFloat(formData.minStock) || 0,
      max_stock: parseFloat(formData.maxStock) || 0,
      daily_usage: parseFloat(formData.dailyUsage) || 0,
      unit_cost: parseFloat(formData.unitCost) || 0
    }, actorName)

    
    if (!result) {
      setError("Failed to add inventory item")
      return
    }
    
    resetItemForm()
    setIsAddItemModalOpen(false)
    
    // CORE RULE: REFRESH PAGE after add
    window.location.reload()
  }

  const openEditItemModal = (item: InventoryItem) => {
    setEditingItemId(item.id)
    // Determine display unit from stored unit
    const displayUnit = (item.unit as DisplayUnit) || 'pcs'
    setFormData({
      name: item.name,
      category: item.category,
      unit: item.unit,
      displayUnit: displayUnit,
      currentStock: (item.current_stock ?? 0) .toString(),
      minStock: (item.min_stock ?? 0).toString(),
      maxStock: (item.max_stock ?? 0).toString(),
      dailyUsage: (item.daily_usage ?? 0).toString(),
      unitCost: (item.unit_cost ?? 0).toString()
    })
    setIsEditItemModalOpen(true)
  }

  // INVENTORY FLOW: Edit item using upsert_inventory()
  // Convert to base unit before saving (kg→gram, liter→ml)
  // CORE RULE: After success → REFRESH PAGE IMMEDIATELY
  const handleEditItem = async () => {
    if (!editingItemId || !formData.name || !formData.currentStock) return
    setError("")
    
    // Convert display unit to base unit
    const stockInBaseUnit = toBaseUnit(
      parseFloat(formData.currentStock) || 0,
      formData.displayUnit
    )
    
    // Call upsert_inventory() with id means update
    const result = await upsertInventory({
      id: editingItemId || undefined,
      name: formData.name,
      category: formData.category,
      unit: formData.displayUnit,
      stock: stockInBaseUnit,
      min_stock: parseFloat(formData.minStock) || 0,
      max_stock: parseFloat(formData.maxStock) || 0,
      daily_usage: parseFloat(formData.dailyUsage) || 0,
      unit_cost: parseFloat(formData.unitCost) || 0
    }, actorName)

    
    if (!result) {
      setError("Failed to update inventory item")
      return
    }
    
    resetItemForm()
    setEditingItemId(null)
    setIsEditItemModalOpen(false)
    
    // CORE RULE: REFRESH PAGE after edit
    window.location.reload()
  }

  // CORE RULE: After success → REFRESH PAGE IMMEDIATELY
  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this inventory item?")) return
    const result = await deleteInventoryItem(id)
    // CORE RULE: REFRESH PAGE after delete
    if (result) {
      window.location.reload()
    }
  }

  // STOCK IN FLOW: Create batch entry via addBatch()
  // This is the ONLY entry point for adding stock
  // addBatch() will: 1) Insert into inventory_batches, 2) Update inventory_items.stock, 3) Insert inventory_transaction
  // CORE RULE: After success → REFRESH PAGE IMMEDIATELY
  const handleStockIn = async () => {
    if (!stockInForm.itemId || !stockInForm.quantity || !stockInForm.unitCost || !stockInForm.supplierName || !stockInForm.expiredDate) return
    setError("")
    
    const result = await addBatch({
      item_id: stockInForm.itemId,
      quantity: parseFloat(stockInForm.quantity) || 0,
      unit: stockInForm.displayUnit,
      unit_cost: parseFloat(stockInForm.unitCost) || 0,
      supplier_name: stockInForm.supplierName,
      received_date: stockInForm.receivedDate,
      expired_date: stockInForm.expiredDate,
      notes: stockInForm.notes || undefined
    }, actorName)

    
    if (!result) {
      setError("Failed to add stock")
      return
    }
    
    setStockInForm({ 
      itemId: "", 
      quantity: "", 
      displayUnit: "pcs", 
      unitCost: "",
      supplierName: "",
      receivedDate: new Date().toISOString().split("T")[0],
      expiredDate: "",
      notes: ""
    })
    setIsAddStockModalOpen(false)
    
    // CORE RULE: REFRESH PAGE after stock in
    window.location.reload()
  }

  // INVENTORY FLOW: Stock Out Manual - convert to base unit, call stock_out_manual()
  // CORE RULE: After success → REFRESH PAGE IMMEDIATELY
  const handleStockOutManual = async () => {
    if (!stockOutForm.itemId || !stockOutForm.quantity) return
    setError("")
    
    // Convert to base unit before saving
    const quantityInBaseUnit = toBaseUnit(
      parseFloat(stockOutForm.quantity) || 0,
      stockOutForm.displayUnit
    )
    
    const result = await stockOutManual(
      stockOutForm.itemId,
      quantityInBaseUnit,
      stockOutForm.reason || 'manual',
      actorName
    )

    
    if (!result) {
      setError("Failed to remove stock")
      return
    }
    
    setStockOutForm({ itemId: "", quantity: "", displayUnit: "pcs", reason: "" })
    setIsStockOutModalOpen(false)
    
    // CORE RULE: REFRESH PAGE after stock out
    window.location.reload()
  }

  // ========== MENU ITEMS ==========
  const filteredMenu = menuItems.filter((item) => {
    const matchesSearch = (item.name || "").toLowerCase().includes(menuSearchQuery.toLowerCase())
    const matchesCategory = selectedMenuCategory === "all" || item.category === selectedMenuCategory
    return matchesSearch && matchesCategory
  })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const resetMenuForm = () => {
    setMenuForm({
      name: "",
      category: "coffee",
      price: "",
      ingredients: []
    })
  }

  const addIngredientRow = () => {
    setMenuForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { inventory_item_id: "", quantity: 0 }]
    }))
  }

  const removeIngredientRow = (index: number) => {
    setMenuForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }))
  }

  const updateIngredient = (index: number, field: keyof MenuRecipeIngredient, value: string | number) => {
    setMenuForm(prev => {
      const updated = [...prev.ingredients]
      if (field === "inventory_item_id") {
        updated[index].inventory_item_id = value as string
      } else {
        updated[index].quantity = typeof value === "string" ? parseFloat(value) || 0 : value
      }
      return { ...prev, ingredients: updated }
    })
  }

  // MENU FLOW: Add Menu with ingredients (quantity MUST be in base unit)
  // CORE RULE: After success → REFRESH PAGE IMMEDIATELY
  const handleAddMenu = async () => {
    if (!menuForm.name || !menuForm.price) return
    setError("")
    
    // Step 1: Insert into menu_items
    const menuResult = await addMenuItem({
      name: menuForm.name,
      type: menuForm.category,
      category: menuForm.category,
      price: parseInt(menuForm.price, 10)
    })
    
    if (!menuResult) {
      setError("Failed to add menu item")
      return
    }
    
    // Step 2: Insert into menu_recipes (ingredient quantity in base unit)
    const validIngredients = menuForm.ingredients.filter(ing => ing.inventory_item_id && ing.quantity > 0)
    if (validIngredients.length > 0) {
      await saveMenuRecipes(menuResult.id, validIngredients)
    }
    
    resetMenuForm()
    setIsAddMenuModalOpen(false)
    
    // CORE RULE: REFRESH PAGE after menu add
    window.location.reload()
  }

  const openEditMenuModal = async (item: MenuItem) => {
    setEditingMenuId(item.id)
    const recipes = await getMenuRecipes(item.id)
    setMenuForm({
      name: item.name,
      category: (item.category as any) || (item.type as any) || "coffee",
      price: item.price.toString(),
      ingredients: recipes
    })
    setIsEditMenuModalOpen(true)
  }

  // CORE RULE: After success → REFRESH PAGE IMMEDIATELY
  const handleEditMenu = async () => {
    if (!editingMenuId || !menuForm.name || !menuForm.price) return
    setError("")
    
    // Update menu_items
    const result = await updateMenuItem(editingMenuId, {
      name: menuForm.name,
      category: menuForm.category,
      price: parseInt(menuForm.price, 10)
    })
    
    if (!result) {
      setError("Failed to update menu item")
      return
    }
    
    // Update menu_recipes (ingredient quantity in base unit)
    const validIngredients = menuForm.ingredients.filter(ing => ing.inventory_item_id && ing.quantity > 0)
    await saveMenuRecipes(editingMenuId, validIngredients)
    
    resetMenuForm()
    setEditingMenuId(null)
    setIsEditMenuModalOpen(false)
    
    // CORE RULE: REFRESH PAGE after menu edit
    window.location.reload()
  }

  // CORE RULE: After success → REFRESH PAGE IMMEDIATELY
  const handleDeleteMenu = async (id: string) => {
    if (!confirm("Are you sure you want to delete this menu item?")) return
    const result = await deleteMenuItem(id)
    // CORE RULE: REFRESH PAGE after menu delete
    if (result) {
      window.location.reload()
    }
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
        </TabsList>

        {/* ========== RAW MATERIALS TAB ========== */}
        <TabsContent value="raw-materials">
          {/* Header Actions */}
          {canEdit && (
            <div className="flex gap-2 mb-6">
              <Button className="rounded-sm" onClick={() => { setStockInForm({ itemId: "", quantity: "", displayUnit: "pcs", unitCost: "", supplierName: "", receivedDate: new Date().toISOString().split("T")[0], expiredDate: "", notes: "" }); setIsAddStockModalOpen(true); }}>
                <PackagePlus className="w-4 h-4 mr-2" />
                Stock In
              </Button>
              <Button variant="outline" className="rounded-sm" onClick={() => { setStockOutForm({ itemId: "", quantity: "", displayUnit: "pcs", reason: "" }); setIsStockOutModalOpen(true); }}>
                <ArrowDownCircle className="w-4 h-4 mr-2" />
                Stock Out
              </Button>
              <Button variant="outline" className="rounded-sm" onClick={() => { resetItemForm(); setIsAddItemModalOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          )}

          {/* Filters */}
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

          {/* Inventory Table */}
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
                        <tr 
                          key={item.id} 
                          className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <span className="font-medium">{item.name}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm text-muted-foreground capitalize">{item.category}</span>
                          </td>
                          <td className="py-4 px-4 text-right font-mono">
                            {item.current_stock} {item.unit}
                          </td>
                          <td className="py-4 px-4 text-right font-mono text-muted-foreground">
                            {item.daily_usage} {item.unit}/day
                          </td>
                          <td className="py-4 px-4 text-right font-mono">
                            {daysRemaining}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              "inline-block px-3 py-1 rounded-sm text-xs font-medium capitalize",
                              getHealthBadge(health)
                            )}>
                              {health}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {canEdit ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-1 hover:bg-muted rounded-sm">
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-sm">
                                  <DropdownMenuItem onClick={() => openEditItemModal(item)}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => handleDeleteItem(item.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
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

        {/* ========== MENU ITEMS TAB ========== */}
        <TabsContent value="menu-items">
          {/* Header Actions - Setup Only (no sales) */}
          {canEdit && (
            <div className="flex gap-2 mb-6">
              <Button className="rounded-sm" onClick={() => { resetMenuForm(); setIsAddMenuModalOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Menu
              </Button>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search menu..."
                value={menuSearchQuery}
                onChange={(e) => setMenuSearchQuery(e.target.value)}
                className="pl-9 rounded-sm"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              {menuCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedMenuCategory(category)}
                  className={cn(
                    "px-4 py-1.5 rounded-sm text-sm capitalize whitespace-nowrap transition-colors",
                    selectedMenuCategory === category
                      ? "bg-foreground text-background"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {category === "non-coffee" ? "Non-Coffee" : category}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[calc(100vh-450px)] overflow-y-auto pb-4">
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
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => openEditMenuModal(item)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteMenu(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {item.recipe && item.recipe.ingredients.length > 0 ? (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                        Recipe
                      </p>
                      <ul className="space-y-1">
                        {item.recipe.ingredients.map((ing, idx) => {
                          const invItem = inventory.find((i) => i.id === ing.item_id)
                          return (
                            <li key={idx} className="text-sm flex justify-between">
                              <span>{invItem?.name || "Unknown"}</span>
                              <span className="text-muted-foreground font-mono">
                                {ing.amount} {invItem?.unit}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recipe defined</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredMenu.length === 0 && (
            <div className="text-center py-12">
              <Coffee className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No menu items found</p>
            </div>
          )}

          {/* Note: Sales functionality moved to Report page */}
          <p className="text-sm text-muted-foreground mt-6 text-center">
            To record sales, go to the Report page.
          </p>
        </TabsContent>
      </Tabs>

      {/* ========== MODALS ========== */}

      {/* Add Inventory Item Modal */}
      <Dialog open={isAddItemModalOpen} onOpenChange={setIsAddItemModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-sm">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
            <DialogDescription>
              Add a new raw material to your inventory.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-sm">
              {error}
            </div>
          )}
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Coffee Beans"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="rounded-sm"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Category *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, category: v as typeof formData.category }))}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat} className="capitalize">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit *</Label>
                <Select 
                  value={formData.unit} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, unit: v }))}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="currentStock">Initial Stock *</Label>
                <Input
                  id="currentStock"
                  type="number"
                  placeholder="e.g. 10"
                  value={formData.currentStock}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentStock: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="dailyUsage">Daily Usage</Label>
                <Input
                  id="dailyUsage"
                  type="number"
                  placeholder="e.g. 5"
                  value={formData.dailyUsage}
                  onChange={(e) => setFormData(prev => ({ ...prev, dailyUsage: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="minStock">Min Stock</Label>
                <Input
                  id="minStock"
                  type="number"
                  placeholder="e.g. 3"
                  value={formData.minStock}
                  onChange={(e) => setFormData(prev => ({ ...prev, minStock: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="maxStock">Max Stock</Label>
                <Input
                  id="maxStock"
                  type="number"
                  placeholder="e.g. 30"
                  value={formData.maxStock}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxStock: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="unitCost">Unit Cost (IDR)</Label>
              <Input
                id="unitCost"
                type="number"
                placeholder="e.g. 15000"
                value={formData.unitCost}
                onChange={(e) => setFormData(prev => ({ ...prev, unitCost: e.target.value }))}
                className="rounded-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddItemModalOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button 
              onClick={handleAddItem} 
              disabled={!formData.name || !formData.currentStock}
              className="rounded-sm"
            >
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Inventory Item Modal */}
      <Dialog open={isEditItemModalOpen} onOpenChange={setIsEditItemModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-sm">
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>
              Update the inventory item details.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-sm">
              {error}
            </div>
          )}
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Item Name *</Label>
              <Input
                id="edit-name"
                placeholder="e.g. Coffee Beans"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="rounded-sm"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-category">Category *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, category: v as typeof formData.category }))}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat} className="capitalize">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="edit-unit">Unit *</Label>
                <Select 
                  value={formData.unit} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, unit: v }))}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-currentStock">Current Stock *</Label>
                <Input
                  id="edit-currentStock"
                  type="number"
                  placeholder="e.g. 10"
                  value={formData.currentStock}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentStock: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="edit-dailyUsage">Daily Usage</Label>
                <Input
                  id="edit-dailyUsage"
                  type="number"
                  placeholder="e.g. 5"
                  value={formData.dailyUsage}
                  onChange={(e) => setFormData(prev => ({ ...prev, dailyUsage: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-minStock">Min Stock</Label>
                <Input
                  id="edit-minStock"
                  type="number"
                  placeholder="e.g. 3"
                  value={formData.minStock}
                  onChange={(e) => setFormData(prev => ({ ...prev, minStock: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="edit-maxStock">Max Stock</Label>
                <Input
                  id="edit-maxStock"
                  type="number"
                  placeholder="e.g. 30"
                  value={formData.maxStock}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxStock: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-unitCost">Unit Cost (IDR)</Label>
              <Input
                id="edit-unitCost"
                type="number"
                placeholder="e.g. 15000"
                value={formData.unitCost}
                onChange={(e) => setFormData(prev => ({ ...prev, unitCost: e.target.value }))}
                className="rounded-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditItemModalOpen(false); resetItemForm(); }} className="rounded-sm">
              Cancel
            </Button>
            <Button 
              onClick={handleEditItem} 
              disabled={!formData.name || !formData.currentStock}
              className="rounded-sm"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock In Modal - MAIN ENTRY POINT FOR ADDING STOCK */}
      {/* Creates batch entry via addBatch() - auto-generates batch number */}
      <Dialog open={isAddStockModalOpen} onOpenChange={setIsAddStockModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-sm">
          <DialogHeader>
            <DialogTitle>Stock In</DialogTitle>
            <DialogDescription>
              Add new stock to inventory. This creates a batch entry with auto-generated batch number.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-sm">
              {error}
            </div>
          )}
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="stockin-item">Item *</Label>
              <Select 
                value={stockInForm.itemId} 
                onValueChange={(v) => {
                  // When item is selected, auto-set the display unit based on inventory item's unit
                  const selectedItem = inventory.find(i => i.id === v)
                  const defaultUnit = selectedItem ? getDefaultDisplayUnit(selectedItem.unit) : 'pcs'
                  setStockInForm(prev => ({ ...prev, itemId: v, displayUnit: defaultUnit }))
                }}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.current_stock} {item.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="stockin-quantity">Quantity *</Label>
                <Input
                  id="stockin-quantity"
                  type="number"
                  placeholder="e.g. 10"
                  value={stockInForm.quantity}
                  onChange={(e) => setStockInForm(prev => ({ ...prev, quantity: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
              {/* Unit dropdown - only show allowed units based on selected item */}
              <div className="grid gap-2">
                <Label htmlFor="stockin-unit">Unit</Label>
                {(() => {
                  const selectedItem = inventory.find(i => i.id === stockInForm.itemId)
                  const allowedUnits = selectedItem ? getAllowedUnitsForItem(selectedItem.unit) : ['pcs']
                  return (
                    <Select 
                      value={stockInForm.displayUnit} 
                      onValueChange={(v) => setStockInForm(prev => ({ ...prev, displayUnit: v as DisplayUnit }))}
                      disabled={!stockInForm.itemId}
                    >
                      <SelectTrigger className="rounded-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedUnits.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                })()}
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="stockin-unitcost">Unit Cost (IDR) *</Label>
              <Input
                id="stockin-unitcost"
                type="number"
                placeholder="e.g. 15000"
                value={stockInForm.unitCost}
                onChange={(e) => setStockInForm(prev => ({ ...prev, unitCost: e.target.value }))}
                className="rounded-sm"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="stockin-supplier">Supplier Name *</Label>
              <Input
                id="stockin-supplier"
                placeholder="e.g. PT Supplier Indonesia"
                value={stockInForm.supplierName}
                onChange={(e) => setStockInForm(prev => ({ ...prev, supplierName: e.target.value }))}
                className="rounded-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="stockin-received">Received Date *</Label>
                <Input
                  id="stockin-received"
                  type="date"
                  value={stockInForm.receivedDate}
                  onChange={(e) => setStockInForm(prev => ({ ...prev, receivedDate: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stockin-expired">Expired Date *</Label>
                <Input
                  id="stockin-expired"
                  type="date"
                  value={stockInForm.expiredDate}
                  onChange={(e) => setStockInForm(prev => ({ ...prev, expiredDate: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="stockin-notes">Notes</Label>
              <Textarea
                id="stockin-notes"
                placeholder="Optional notes..."
                value={stockInForm.notes}
                onChange={(e) => setStockInForm(prev => ({ ...prev, notes: e.target.value }))}
                className="rounded-sm"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStockModalOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button 
              onClick={handleStockIn} 
              disabled={!stockInForm.itemId || !stockInForm.quantity || !stockInForm.unitCost || !stockInForm.supplierName || !stockInForm.expiredDate}
              className="rounded-sm"
            >
              Stock In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Out Manual Modal */}
      <Dialog open={isStockOutModalOpen} onOpenChange={setIsStockOutModalOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-sm">
          <DialogHeader>
            <DialogTitle>Stock Out (Manual)</DialogTitle>
            <DialogDescription>
              Remove stock manually (waste, damage, etc). Converts to base unit.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-sm">
              {error}
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="stockout-item">Item *</Label>
              <Select 
                value={stockOutForm.itemId} 
                onValueChange={(v) => {
                  // When item is selected, auto-set the display unit based on inventory item's unit
                  const selectedItem = inventory.find(i => i.id === v)
                  const defaultUnit = selectedItem ? getDefaultDisplayUnit(selectedItem.unit) : 'pcs'
                  setStockOutForm(prev => ({ ...prev, itemId: v, displayUnit: defaultUnit }))
                }}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.current_stock} {item.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="stockout-quantity">Quantity *</Label>
                <Input
                  id="stockout-quantity"
                  type="number"
                  placeholder="e.g. 5"
                  value={stockOutForm.quantity}
                  onChange={(e) => setStockOutForm(prev => ({ ...prev, quantity: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
              {/* Unit dropdown - only show allowed units based on selected item */}
              <div className="grid gap-2">
                <Label htmlFor="stockout-unit">Unit</Label>
                {(() => {
                  const selectedItem = inventory.find(i => i.id === stockOutForm.itemId)
                  const allowedUnits = selectedItem ? getAllowedUnitsForItem(selectedItem.unit) : ['pcs']
                  return (
                    <Select 
                      value={stockOutForm.displayUnit} 
                      onValueChange={(v) => setStockOutForm(prev => ({ ...prev, displayUnit: v as DisplayUnit }))}
                      disabled={!stockOutForm.itemId}
                    >
                      <SelectTrigger className="rounded-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedUnits.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                })()}
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="stockout-reason">Reason</Label>
              <Select 
                value={stockOutForm.reason} 
                onValueChange={(v) => setStockOutForm(prev => ({ ...prev, reason: v }))}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="waste">Waste</SelectItem>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="adjustment">Stock Adjustment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStockOutModalOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button 
              onClick={handleStockOutManual} 
              disabled={!stockOutForm.itemId || !stockOutForm.quantity}
              className="rounded-sm"
              variant="destructive"
            >
              Remove Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Menu Modal - FLOW 1 (with ingredients) */}
      <Dialog open={isAddMenuModalOpen} onOpenChange={setIsAddMenuModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-sm">
          <DialogHeader>
            <DialogTitle>Add Menu Item</DialogTitle>
            <DialogDescription>
              Create a new menu item with its recipe.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-sm">
              {error}
            </div>
          )}
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="menu-name">Name *</Label>
              <Input
                id="menu-name"
                placeholder="e.g. Vanilla Latte"
                value={menuForm.name}
                onChange={(e) => setMenuForm(prev => ({ ...prev, name: e.target.value }))}
                className="rounded-sm"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="menu-category">Category *</Label>
                <Select 
                  value={menuForm.category} 
                  onValueChange={(v) => setMenuForm(prev => ({ ...prev, category: v as typeof menuForm.category }))}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coffee">Coffee</SelectItem>
                    <SelectItem value="non-coffee">Non-Coffee</SelectItem>
                    <SelectItem value="food">Food</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="menu-price">Price (IDR) *</Label>
                <Input
                  id="menu-price"
                  type="number"
                  placeholder="e.g. 35000"
                  value={menuForm.price}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, price: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
            </div>

            {/* Ingredients Section */}
            <div className="grid gap-2">
              <Label>Ingredients</Label>
              <div className="space-y-2">
                {menuForm.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select 
                      value={ing.inventory_item_id} 
                      onValueChange={(v) => updateIngredient(idx, "inventory_item_id", v)}
                    >
                      <SelectTrigger className="flex-1 rounded-sm">
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventory.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({item.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={ing.quantity || ""}
                      onChange={(e) => updateIngredient(idx, "quantity", e.target.value)}
                      className="w-24 rounded-sm"
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 text-destructive shrink-0"
                      onClick={() => removeIngredientRow(idx)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addIngredientRow} className="rounded-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Ingredient
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddMenuModalOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button 
              onClick={handleAddMenu} 
              disabled={!menuForm.name || !menuForm.price}
              className="rounded-sm"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Menu Modal */}
      <Dialog open={isEditMenuModalOpen} onOpenChange={setIsEditMenuModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-sm">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
            <DialogDescription>
              Update the menu item and its recipe.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-sm">
              {error}
            </div>
          )}
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="edit-menu-name">Name *</Label>
              <Input
                id="edit-menu-name"
                placeholder="e.g. Vanilla Latte"
                value={menuForm.name}
                onChange={(e) => setMenuForm(prev => ({ ...prev, name: e.target.value }))}
                className="rounded-sm"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-menu-category">Category *</Label>
                <Select 
                  value={menuForm.category} 
                  onValueChange={(v) => setMenuForm(prev => ({ ...prev, category: v as typeof menuForm.category }))}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coffee">Coffee</SelectItem>
                    <SelectItem value="non-coffee">Non-Coffee</SelectItem>
                    <SelectItem value="food">Food</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="edit-menu-price">Price (IDR) *</Label>
                <Input
                  id="edit-menu-price"
                  type="number"
                  placeholder="e.g. 35000"
                  value={menuForm.price}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, price: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
            </div>

            {/* Ingredients Section */}
            <div className="grid gap-2">
              <Label>Ingredients</Label>
              <div className="space-y-2">
                {menuForm.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select 
                      value={ing.inventory_item_id} 
                      onValueChange={(v) => updateIngredient(idx, "inventory_item_id", v)}
                    >
                      <SelectTrigger className="flex-1 rounded-sm">
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventory.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({item.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={ing.quantity || ""}
                      onChange={(e) => updateIngredient(idx, "quantity", e.target.value)}
                      className="w-24 rounded-sm"
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 text-destructive shrink-0"
                      onClick={() => removeIngredientRow(idx)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addIngredientRow} className="rounded-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Ingredient
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditMenuModalOpen(false); resetMenuForm(); }} className="rounded-sm">
              Cancel
            </Button>
            <Button 
              onClick={handleEditMenu} 
              disabled={!menuForm.name || !menuForm.price}
              className="rounded-sm"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
