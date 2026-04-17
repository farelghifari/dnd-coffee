"use client"

import { useState, useEffect } from "react"
import {
  getInventory,
  getMenuItems,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  saveMenuRecipes,
  getMenuRecipes,
  getMenuHpp,
  subscribeToInventoryItems,
  subscribeToMenuItems,
  toBaseUnit,
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
  Coffee,
  Search,
  Plus,
  Filter,
  Pencil,
  Trash2,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"

const categories = ["all", "coffee", "non-coffee", "food"] as const
const menuCategoryOptions = ["coffee", "non-coffee", "food"] as const

// Extended ingredient type with unit selection
interface IngredientWithUnit extends MenuRecipeIngredient {
  unit: DisplayUnit
}

export default function MenuPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuHpp, setMenuHpp] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<typeof categories[number]>("all")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState("")
  const [formCategory, setFormCategory] = useState<"coffee" | "non-coffee" | "food">("coffee")
  const [formPrice, setFormPrice] = useState("")
  const [formIngredients, setFormIngredients] = useState<IngredientWithUnit[]>([])

  // Ingredients modal state
  const [isIngredientsModalOpen, setIsIngredientsModalOpen] = useState(false)
  const [ingredientsMenuId, setIngredientsMenuId] = useState<string | null>(null)

  // Fetch HPP for all menus
  const fetchMenuHpp = async (menus: MenuItem[]) => {
    const hppData: Record<string, number> = {}
    for (const menu of menus) {
      const hpp = await getMenuHpp(menu.id)
      hppData[menu.id] = hpp
    }
    setMenuHpp(hppData)
  }

  // REALTIME: Subscribe to inventory_items and menu_items
  // On change: update only affected row, NEVER reload page
  useEffect(() => {
    fetchData()

    // Subscribe to inventory changes for ingredient data
    const unsubInventory = subscribeToInventoryItems((payload) => {
      if (payload?.new) {
        const newItem = (payload.new as unknown) as InventoryItem
        setInventory(prev => {
          const existingIndex = prev.findIndex(item => item.id === newItem.id)
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = { ...newItem, current_stock: newItem.stock }
            return updated
          }
          return [...prev, { ...newItem, current_stock: newItem.stock }]
        })
        // Refetch HPP when inventory changes (costs may have changed)
        getMenuItems().then(menus => fetchMenuHpp(menus))
      } else if (payload?.old && payload?.eventType === 'DELETE') {
        const oldItem = (payload.old as unknown) as InventoryItem
        setInventory(prev => prev.filter(item => item.id !== oldItem.id))
      } else {
        getInventory().then(setInventory)
      }
    })

    // Subscribe to menu_items changes
    const unsubMenu = subscribeToMenuItems?.((payload) => {
      if (payload?.new) {
        const newItem = (payload.new as unknown) as MenuItem
        setMenuItems(prev => {
          const existingIndex = prev.findIndex(item => item.id === newItem.id)
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = newItem
            return updated
          }
          return [...prev, newItem]
        })
        // Refetch HPP for updated menu
        getMenuHpp(newItem.id).then(hpp => {
          setMenuHpp(prev => ({ ...prev, [newItem.id]: hpp }))
        })
      } else if (payload?.old && payload?.eventType === 'DELETE') {
        const oldItem = (payload.old as unknown) as MenuItem
        setMenuItems(prev => prev.filter(item => item.id !== oldItem.id))
      } else {
        getMenuItems().then(menus => {
          setMenuItems(menus)
          fetchMenuHpp(menus)
        })
      }
    }) || (() => { })

    return () => {
      unsubInventory()
      unsubMenu()
    }
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    const [inventoryData, menuData] = await Promise.all([
      getInventory(),
      getMenuItems()
    ])
    setInventory(inventoryData)
    setMenuItems(menuData)
    // Fetch HPP for all menus
    await fetchMenuHpp(menuData)
    setIsLoading(false)
  }

  const filteredMenu = menuItems.filter((item) => {
    const matchesSearch = (item.name || "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const getIngredientName = (itemId: string) => {
    const item = inventory.find((i) => i.id === itemId)
    return item?.name || "Unknown"
  }

  // MENU FLOW: Add menu item
  // VALIDATION: name, category (must not be null), and price are required
  // CORE RULE: After success → REFRESH PAGE IMMEDIATELY
  const handleAddItem = async () => {
    if (!formName || !formPrice || !formCategory) return

    const result = await addMenuItem({
      name: formName,
      type: formCategory,
      category: formCategory,
      price: parseInt(formPrice, 10),
    })

    // Reset form
    setFormName("")
    setFormCategory("coffee")
    setFormPrice("")
    setIsAddModalOpen(false)

    // CORE RULE: REFRESH PAGE after add
    if (result) {
      window.location.reload()
    }
  }

  // CORE RULE: After success → REFRESH PAGE IMMEDIATELY
  const handleEditItem = async () => {
    // VALIDATION: name, category (must not be null), and price are required
    if (!editingItem || !formName || !formCategory || !formPrice) return

    const result = await updateMenuItem(editingItem, {
      name: formName,
      type: formCategory,
      category: formCategory,
      price: parseInt(formPrice, 10),
    })

    // Reset form
    setFormName("")
    setFormCategory("coffee")
    setFormPrice("")
    setEditingItem(null)
    setIsEditModalOpen(false)

    // CORE RULE: REFRESH PAGE after edit
    if (result) {
      window.location.reload()
    }
  }

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item.id)
    setFormName(item.name)
    setFormCategory(item.type)
    setFormPrice(item.price.toString())
    setIsEditModalOpen(true)
  }

  // CORE RULE: After success → REFRESH PAGE IMMEDIATELY
  const handleDeleteItem = async (id: string) => {
    if (confirm("Are you sure you want to delete this menu item?")) {
      const result = await deleteMenuItem(id)
      // CORE RULE: REFRESH PAGE after delete
      if (result) {
        window.location.reload()
      }
    }
  }

  // Open ingredients modal
  const openIngredientsModal = async (item: MenuItem) => {
    setIngredientsMenuId(item.id)
    const recipes = await getMenuRecipes(item.id)
    // Convert to IngredientWithUnit with default unit from inventory item
    // IMPORTANT: Use getDefaultDisplayUnit to properly map inventory unit
    const ingredientsWithUnit: IngredientWithUnit[] = recipes.map(r => {
      const invItem = inventory.find(i => i.id === r.inventory_item_id)
      return {
        ...r,
        unit: invItem ? getDefaultDisplayUnit(invItem.unit) : 'pcs'
      }
    })
    setFormIngredients(ingredientsWithUnit)
    setIsIngredientsModalOpen(true)
  }

  // Add ingredient row with unit - unit will be set when inventory item is selected
  const addIngredientRow = () => {
    setFormIngredients([...formIngredients, {
      inventory_item_id: "",
      quantity: 0,
      unit: "pcs" // Placeholder - will be updated when inventory item is selected
    }])
  }

  // Remove ingredient row
  const removeIngredientRow = (index: number) => {
    setFormIngredients(formIngredients.filter((_, i) => i !== index))
  }

  // Update ingredient (quantity will be converted to base unit on save)
  // IMPORTANT: When selecting inventory item, set unit based on inventory_items.unit
  const updateIngredient = (index: number, field: keyof IngredientWithUnit, value: string | number) => {
    const updated = [...formIngredients]
    if (field === "inventory_item_id") {
      updated[index].inventory_item_id = value as string
      // Set default unit based on inventory item's unit (NEVER default to pcs)
      const invItem = inventory.find(i => i.id === value)
      if (invItem) {
        // Use the inventory item's unit as the default display unit
        updated[index].unit = getDefaultDisplayUnit(invItem.unit)
      }
    } else if (field === "unit") {
      updated[index].unit = value as DisplayUnit
    } else {
      updated[index].quantity = typeof value === "string" ? parseFloat(value) || 0 : value
    }
    setFormIngredients(updated)
  }

  // Save ingredients (convert to base unit: kg→gram, liter→ml)
  // CORE RULE: After success → REFRESH PAGE IMMEDIATELY
  const handleSaveIngredients = async () => {
    if (!ingredientsMenuId) return

    // Filter out empty ingredients and convert to base unit
    const validIngredients: MenuRecipeIngredient[] = formIngredients
      .filter(ing => ing.inventory_item_id && ing.quantity > 0)
      .map(ing => ({
        inventory_item_id: ing.inventory_item_id,
        quantity: toBaseUnit(ing.quantity, ing.unit)
      }))

    const result = await saveMenuRecipes(ingredientsMenuId, validIngredients)

    setIngredientsMenuId(null)
    setFormIngredients([])
    setIsIngredientsModalOpen(false)

    // CORE RULE: REFRESH PAGE after saving ingredients
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
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Menu</h1>
          <p className="text-muted-foreground">Manage products and recipes (setup only)</p>
        </div>
        <div className="flex gap-2">
          <Button className="rounded-sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-sm"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          {categories.map((category) => (
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
              {category === "non-coffee" ? "Non-Coffee" : category}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[calc(100vh-280px)] overflow-y-auto pb-4">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEditModal(item)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* HPP Display */}
              <div className="mb-3 p-2 bg-muted/50 rounded-sm">
                <p className="text-sm font-medium">
                  HPP: {formatPrice(menuHpp[item.id] || 0)}
                </p>
                {menuHpp[item.id] > 0 && item.price > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Margin: {Math.round(((item.price - menuHpp[item.id]) / item.price) * 100)}%
                  </p>
                )}
              </div>

              {item.recipe && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    Recipe
                  </p>
                  <ul className="space-y-1">
                    {item.recipe.ingredients.map((ing, idx) => {
                      const invItem = inventory.find((i) => i.id === ing.inventory_item_id)
                      return (
                        <li key={idx} className="text-sm flex justify-between">
                          <span>{getIngredientName(ing.inventory_item_id)}</span>
                          <span className="text-muted-foreground font-mono">
                            {ing.quantity} {invItem?.unit}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {!item.recipe && (
                <p className="text-sm text-muted-foreground">No recipe defined</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full rounded-sm"
                onClick={() => openIngredientsModal(item)}
              >
                Manage Ingredients
              </Button>
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

      {/* Add Item Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Menu Item</DialogTitle>
            <DialogDescription>
              Create a new menu item. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Vanilla Latte"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="rounded-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={formCategory} onValueChange={(v) => setFormCategory(v as typeof formCategory)}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {menuCategoryOptions.map((cat) => (
                    <SelectItem key={cat} value={cat} className="capitalize">
                      {cat === "non-coffee" ? "Non-Coffee" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price">Price (IDR) *</Label>
              <Input
                id="price"
                type="number"
                placeholder="e.g. 35000"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                className="rounded-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={!formName || !formCategory || !formPrice}
              className="rounded-sm"
            >
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
            <DialogDescription>
              Update the menu item details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                placeholder="e.g. Vanilla Latte"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="rounded-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-category">Category *</Label>
              <Select value={formCategory} onValueChange={(v) => setFormCategory(v as typeof formCategory)}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {menuCategoryOptions.map((cat) => (
                    <SelectItem key={cat} value={cat} className="capitalize">
                      {cat === "non-coffee" ? "Non-Coffee" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-price">Price (IDR) *</Label>
              <Input
                id="edit-price"
                type="number"
                placeholder="e.g. 35000"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                className="rounded-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button
              onClick={handleEditItem}
              disabled={!formName || !formCategory || !formPrice}
              className="rounded-sm"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Ingredients Modal with Unit Selection */}
      <Dialog open={isIngredientsModalOpen} onOpenChange={setIsIngredientsModalOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-sm">
          <DialogHeader>
            <DialogTitle>Manage Ingredients</DialogTitle>
            <DialogDescription>
              Add ingredients with quantity and unit. Units will be converted to base (gram/ml/pcs) on save.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[400px] overflow-y-auto">
            {formIngredients.map((ing, idx) => (
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
                  className="w-20 rounded-sm"
                />
                {/* Unit dropdown - only show allowed units based on selected inventory item */}
                {(() => {
                  const invItem = inventory.find(i => i.id === ing.inventory_item_id)
                  const allowedUnits = invItem ? getAllowedUnitsForItem(invItem.unit) : ['pcs']
                  return (
                    <Select
                      value={ing.unit}
                      onValueChange={(v) => updateIngredient(idx, "unit", v)}
                      disabled={!ing.inventory_item_id}
                    >
                      <SelectTrigger className="w-24 rounded-sm">
                        <SelectValue placeholder="Unit" />
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive"
                  onClick={() => removeIngredientRow(idx)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={addIngredientRow} className="rounded-sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Ingredient
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIngredientsModalOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button onClick={handleSaveIngredients} className="rounded-sm">
              Save Ingredients
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
