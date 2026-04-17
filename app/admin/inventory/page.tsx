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
  getInventoryOpnames,
  addInventoryOpname,
  uploadOpexAttachment,
  subscribeToInventoryTransactions,
  subscribeToInventoryItems,
  toBaseUnit,
  fromBaseUnit,
  getAllowedUnitsForItem,
  getDefaultDisplayUnit,
  type InventoryItem,
  type MenuItem,
  type MenuRecipeIngredient,
  type MonthlyOpex,
  type InventoryOpname,
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

const inventoryCategories = ["all", "beans", "milk", "syrup", "cups", "food"] as const
const categoryOptions = ["beans", "milk", "syrup", "cups", "food"] as const
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
  const [opnameHistory, setOpnameHistory] = useState<InventoryOpname[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [menuSearchQuery, setMenuSearchQuery] = useState("")
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>("all")
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false)
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false)
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false)
  const [isStockOutModalOpen, setIsStockOutModalOpen] = useState(false)
  const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState(false)
  const [isEditMenuModalOpen, setIsEditMenuModalOpen] = useState(false)
  const [isAddOpexModalOpen, setIsAddOpexModalOpen] = useState(false)
  const [isRecordOpnameModalOpen, setIsRecordOpnameModalOpen] = useState(false)

  // Forms
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    category: "beans" as typeof categoryOptions[number],
    unit: "gram",
    displayUnit: "gram" as DisplayUnit,
    currentStock: "",
    dailyUsage: "",
    minStock: "",
    maxStock: "",
    unitCost: ""
  })

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

  const [stockOutForm, setStockOutForm] = useState({
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
    ingredients: [] as MenuRecipeIngredient[]
  })

  const [opexForm, setOpexForm] = useState({
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
    category: "Gaji",
    amount: "",
    notes: ""
  })
  const [opexFile, setOpexFile] = useState<File | null>(null)

  const [opnameForm, setOpnameForm] = useState({
    itemId: "",
    actualStock: "",
    displayUnit: "pcs" as DisplayUnit,
    reason: ""
  })

  const opexCategories = ["Gaji", "Sewa", "Listrik/Air", "Pajak", "Marketing", "Maintenance", "Lainnya"]

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
      const [invData, menuData, opexData, opnameData] = await Promise.all([
        getInventory(),
        getMenuItems(),
        getMonthlyOpex(),
        getInventoryOpnames()
      ])
      
      const menusWithRecipes = await Promise.all(
        menuData.map(async (menu) => {
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
      setOpnameHistory(opnameData)
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
      unitCost: ""
    })
    setError(null)
  }

  const resetMenuForm = () => {
    setMenuForm({
      id: "",
      name: "",
      category: "coffee",
      price: "",
      ingredients: []
    })
    setError(null)
  }

  const handleAddItem = async () => {
    if (!formData.name || !formData.currentStock) return
    
    try {
      const baseStock = toBaseUnit(parseFloat(formData.currentStock), formData.displayUnit)
      const baseDaily = toBaseUnit(parseFloat(formData.dailyUsage || "0"), formData.displayUnit)
      const baseMin = toBaseUnit(parseFloat(formData.minStock || "0"), formData.displayUnit)
      const baseMax = toBaseUnit(parseFloat(formData.maxStock || "0"), formData.displayUnit)
      
      await upsertInventory({
        name: formData.name,
        category: formData.category,
        unit: formData.unit,
        stock: baseStock,
        daily_usage: baseDaily,
        min_stock: baseMin,
        max_stock: baseMax,
        unit_cost: parseFloat(formData.unitCost || "0"),
        last_updated: new Date().toISOString()
      } as any)
      
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
      const baseStock = toBaseUnit(parseFloat(formData.currentStock), formData.displayUnit)
      const baseDaily = toBaseUnit(parseFloat(formData.dailyUsage || "0"), formData.displayUnit)
      const baseMin = toBaseUnit(parseFloat(formData.minStock || "0"), formData.displayUnit)
      const baseMax = toBaseUnit(parseFloat(formData.maxStock || "0"), formData.displayUnit)

      await upsertInventory({
        id: formData.id,
        name: formData.name,
        category: formData.category,
        unit: formData.unit,
        stock: baseStock,
        daily_usage: baseDaily,
        min_stock: baseMin,
        max_stock: baseMax,
        unit_cost: parseFloat(formData.unitCost || "0"),
        last_updated: new Date().toISOString()
      } as any)
      
      setIsEditItemModalOpen(false)
      resetItemForm()
      fetchData()
    } catch (err) {
      setError("Failed to update inventory item")
    }
  }

  const openEditItemModal = (item: InventoryItem) => {
    const dUnit = getDefaultDisplayUnit(item.unit)
    setFormData({
      id: item.id,
      name: item.name,
      category: item.category as any,
      unit: item.unit,
      displayUnit: dUnit,
      currentStock: fromBaseUnit(item.stock || 0, dUnit).toString(),
      dailyUsage: fromBaseUnit(item.daily_usage || 0, dUnit).toString(),
      minStock: fromBaseUnit(item.min_stock || 0, dUnit).toString(),
      maxStock: fromBaseUnit(item.max_stock || 0, dUnit).toString(),
      unitCost: (item.unit_cost || 0).toString()
    })
    setIsEditItemModalOpen(true)
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item? This will also affect existing recipes.")) return
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
      const baseQty = toBaseUnit(parseFloat(stockInForm.quantity), stockInForm.displayUnit)
      
      await addBatch({
        item_id: stockInForm.itemId,
        quantity: baseQty,
        unit: stockInForm.displayUnit,
        unit_cost: parseFloat(stockInForm.unitCost),
        supplier_name: stockInForm.supplierName,
        received_date: stockInForm.receivedDate,
        expired_date: stockInForm.expiredDate,
        notes: stockInForm.notes
      }, actorName)
      
      setIsAddStockModalOpen(false)
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
      fetchData()
    } catch (err) {
      setError("Failed to add stock")
    }
  }

  // Stock Out (Manual Waste/Damage)
  const handleStockOutManual = async () => {
    if (!stockOutForm.itemId || !stockOutForm.quantity) return
    
    try {
      const baseQty = toBaseUnit(parseFloat(stockOutForm.quantity), stockOutForm.displayUnit)
      
      await stockOutManual(
        stockOutForm.itemId,
        baseQty,
        stockOutForm.reason,
        actorName
      )
      
      setIsStockOutModalOpen(false)
      setStockOutForm({ itemId: "", quantity: "", displayUnit: "pcs", reason: "" })
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

  const toggleIngredientUnit = (index: number) => {
    setMenuForm(prev => {
      const newIngredients = [...prev.ingredients];
      const currentUnit = newIngredients[index].unit;
      const currentQty = newIngredients[index].quantity || 0;
      
      if (currentUnit === 'gram') {
        newIngredients[index].unit = 'kg' as DisplayUnit;
        newIngredients[index].quantity = currentQty / 1000;
      } else if (currentUnit === 'kg') {
        newIngredients[index].unit = 'gram' as DisplayUnit;
        newIngredients[index].quantity = currentQty * 1000;
      } else if (currentUnit === 'ml') {
        newIngredients[index].unit = 'liter' as DisplayUnit;
        newIngredients[index].quantity = currentQty / 1000;
      } else if (currentUnit === 'liter') {
        newIngredients[index].unit = 'ml' as DisplayUnit;
        newIngredients[index].quantity = currentQty * 1000;
      }
      return { ...prev, ingredients: newIngredients };
    });
  };

  const handleAddMenu = async () => {
    if (!menuForm.name || !menuForm.price) return
    try {
      const menuId = await addMenuItem({
        name: menuForm.name,
        type: menuForm.category,
        price: parseFloat(menuForm.price),
        status: 'active'
      })
      
      if (menuId && menuForm.ingredients.length > 0) {
        // Convert quantities to base unit (g/ml) for DB
        const baseIngredients = menuForm.ingredients.map(ing => ({
          inventory_item_id: ing.inventory_item_id,
          quantity: toBaseUnit(ing.quantity, ing.unit || 'pcs' as DisplayUnit)
        }))
        await saveMenuRecipes(menuId, baseIngredients)
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
        price: parseFloat(menuForm.price)
      })
      
      const baseIngredients = menuForm.ingredients.map(ing => ({
        inventory_item_id: ing.inventory_item_id,
        quantity: toBaseUnit(ing.quantity, ing.unit || 'pcs' as DisplayUnit)
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
      ingredients: (item.recipe?.ingredients || []).map(ing => {
        const invItem = inventory.find(i => i.id === ing.inventory_item_id)
        const dUnit = getDefaultDisplayUnit(invItem?.unit || 'pcs')
        return {
          inventory_item_id: ing.inventory_item_id,
          quantity: fromBaseUnit(ing.quantity, dUnit),
          unit: dUnit as DisplayUnit
        }
      })
    })
    setIsEditMenuModalOpen(true)
  }

  const handleDeleteMenu = async (id: string) => {
    if (!confirm("Are you sure you want to delete this menu item?")) return
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
      const actual = toBaseUnit(parseFloat(opnameForm.actualStock), opnameForm.displayUnit)
      
      await addInventoryOpname({
        item_id: opnameForm.itemId,
        theoretical_stock: theoretical,
        actual_stock: actual,
        difference: actual - theoretical,
        reason: opnameForm.reason,
        actor_name: actorName
      })
      
      setIsRecordOpnameModalOpen(false)
      setOpnameForm({ itemId: "", actualStock: "", displayUnit: "pcs", reason: "" })
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
                            {parseFloat(fromBaseUnit(item.stock ?? 0, (item.unit as DisplayUnit) || 'pcs').toFixed(4))} {item.unit}
                          </td>
                          <td className="py-4 px-4 text-right font-mono text-muted-foreground">
                            {parseFloat(fromBaseUnit(item.daily_usage ?? 0, (item.unit as DisplayUnit) || 'pcs').toFixed(4))} {item.unit}/day
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
                          }, 0) || 0)
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
                    </div>
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
                  </tr>
                </thead>
                <tbody>
                  {opnameHistory.map((opname) => {
                    const item = inventory.find(i => i.id === opname.item_id);
                    const unit = (item?.unit as DisplayUnit) || 'pcs';
                    return (
                      <tr key={opname.id} className="border-b border-border">
                        <td className="py-4 px-4 text-xs">{new Date(opname.created_at).toLocaleString()}</td>
                        <td className="py-4 px-4 font-medium">{item?.name || "Unknown"}</td>
                        <td className="py-4 px-4 text-right font-mono">{parseFloat(fromBaseUnit(opname.theoretical_stock, unit).toFixed(4))} {unit}</td>
                        <td className="py-4 px-4 text-right font-mono font-bold">{parseFloat(fromBaseUnit(opname.actual_stock, unit).toFixed(4))} {unit}</td>
                        <td className={`py-4 px-4 text-right font-mono font-bold ${opname.difference < 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                          {opname.difference > 0 ? '+' : ''}{parseFloat(fromBaseUnit(opname.difference, unit).toFixed(4))} {unit}
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
          <DialogHeader><DialogTitle>{isEditItemModalOpen ? "Edit" : "Add"} Inventory Item</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <Input placeholder="Item Name" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-4">
              <Select value={formData.category} onValueChange={(v) => setFormData(p => ({ ...p, category: v as any }))}>
                <SelectTrigger><SelectValue placeholder="Category"/></SelectTrigger>
                <SelectContent>{categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={formData.displayUnit} onValueChange={(v) => setFormData(p => ({ ...p, unit: v, displayUnit: v as DisplayUnit }))}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{unitOptions.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" placeholder="Stock" value={formData.currentStock} onChange={(e) => setFormData(p => ({...p, currentStock: e.target.value}))} />
              <Input type="number" placeholder="Unit Cost" value={formData.unitCost} onChange={(e) => setFormData(p => ({...p, unitCost: e.target.value}))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={isEditItemModalOpen ? handleEditItem : handleAddItem}>{isEditItemModalOpen ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Stock In Modal */}
      <Dialog open={isAddStockModalOpen} onOpenChange={setIsAddStockModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-sm">
          <DialogHeader><DialogTitle>Stock In</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <Select value={stockInForm.itemId} onValueChange={(v) => {
              const item = inventory.find(i => i.id === v);
              setStockInForm(p => ({ ...p, itemId: v, displayUnit: item ? getDefaultDisplayUnit(item.unit) : 'pcs' }));
            }}>
              <SelectTrigger><SelectValue placeholder="Select Item"/></SelectTrigger>
              <SelectContent>{inventory.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" placeholder="Quantity" value={stockInForm.quantity} onChange={(e) => setStockInForm(p => ({ ...p, quantity: e.target.value }))} />
            <Input placeholder="Supplier" value={stockInForm.supplierName} onChange={(e) => setStockInForm(p => ({ ...p, supplierName: e.target.value }))} />
            <Input type="date" value={stockInForm.expiredDate} onChange={(e) => setStockInForm(p => ({ ...p, expiredDate: e.target.value }))} />
          </div>
          <DialogFooter><Button onClick={handleStockIn}>Stock In</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Menu Modal */}
      <Dialog open={isAddMenuModalOpen || isEditMenuModalOpen} onOpenChange={(o) => { if(!o) { setIsAddMenuModalOpen(false); setIsEditMenuModalOpen(false); resetMenuForm(); }}}>
        <DialogContent className="sm:max-w-[500px] rounded-sm">
          <DialogHeader><DialogTitle>{isEditMenuModalOpen ? "Edit" : "Add"} Menu</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <Input placeholder="Menu Name" value={menuForm.name} onChange={(e) => setMenuForm(p => ({ ...p, name: e.target.value }))} />
            <Input type="number" placeholder="Price" value={menuForm.price} onChange={(e) => setMenuForm(p => ({ ...p, price: e.target.value }))} />
            <div className="space-y-2">
              <Label>Ingredients</Label>
              {menuForm.ingredients.map((ing, idx) => (
                <div key={idx} className="flex gap-1">
                  <Select value={ing.inventory_item_id} onValueChange={(v) => updateIngredient(idx, 'inventory_item_id', v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Item"/></SelectTrigger>
                    <SelectContent>{inventory.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input className="w-20" type="number" value={ing.quantity} onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)} />
                  <Button variant="ghost" size="icon" onClick={() => removeIngredientRow(idx)}><X className="w-4 h-4"/></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addIngredientRow}><Plus className="w-4 h-4 mr-2"/>Add</Button>
            </div>
          </div>
          <DialogFooter><Button onClick={isEditMenuModalOpen ? handleEditMenu : handleAddMenu}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Opname Modal */}
      <Dialog open={isRecordOpnameModalOpen} onOpenChange={setIsRecordOpnameModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-sm">
          <DialogHeader><DialogTitle>Stock Take (Opname)</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <Select value={opnameForm.itemId} onValueChange={(v) => {
              const item = inventory.find(i => i.id === v);
              setOpnameForm(p => ({ ...p, itemId: v, displayUnit: item ? getDefaultDisplayUnit(item.unit) : 'pcs' }));
            }}>
              <SelectTrigger><SelectValue placeholder="Item"/></SelectTrigger>
              <SelectContent>{inventory.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" placeholder="Actual Stock Count" value={opnameForm.actualStock} onChange={(e) => setOpnameForm(p => ({ ...p, actualStock: e.target.value }))} />
            <Textarea placeholder="Reason" value={opnameForm.reason} onChange={(e) => setOpnameForm(p => ({ ...p, reason: e.target.value }))} />
          </div>
          <DialogFooter><Button onClick={handleAddOpname}>Record Audit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Overhead Modal */}
      <Dialog open={isAddOpexModalOpen} onOpenChange={setIsAddOpexModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-sm">
          <DialogHeader><DialogTitle>Add Overhead</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <Input type="month" value={opexForm.month} onChange={(e) => setOpexForm(p => ({...p, month: e.target.value}))} />
            <Select value={opexForm.category} onValueChange={(v) => setOpexForm(p => ({ ...p, category: v }))}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{opexCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" placeholder="Amount" value={opexForm.amount} onChange={(e) => setOpexForm(p => ({...p, amount: e.target.value}))} />
            <Input type="file" onChange={(e) => setOpexFile(e.target.files?.[0] || null)} />
          </div>
          <DialogFooter><Button onClick={handleAddOpex}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
