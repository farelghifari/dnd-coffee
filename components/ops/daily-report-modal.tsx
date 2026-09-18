"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  X, 
  Plus, 
  Minus, 
  ShoppingCart, 
  Check, 
  AlertCircle,
  CalendarDays,
  Percent,
  Tag,
  Layers
} from "lucide-react"
import { 
  getMenuItems, 
  bulkSellMenu,
  getInventory,
  getAllMenuRecipes,
  type MenuItem, 
  type BulkSaleItem,
  type InventoryItem
} from "@/lib/api/supabase-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { cn, getLocalYYYYMMDD } from "@/lib/utils"
import { toast } from "sonner"

interface DailyReportModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmitSuccess: () => void
}

/**
 * Custom date logic for Ops:
 * If current time is before 04:00 AM, default to YESTERDAY.
 */
function getDefaultOpsDate() {
  const now = new Date()
  const hour = now.getHours()
  
  // Get current local date in YYYY-MM-DD format
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  
  if (hour < 4) {
    // Before 4 AM, it's still yesterday's business day
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yYear = yesterday.getFullYear()
    const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0')
    const yDay = String(yesterday.getDate()).padStart(2, '0')
    return `${yYear}-${yMonth}-${yDay}`
  }
  
  return `${year}-${month}-${day}`
}

export function DailyReportModal({ isOpen, onClose, onSubmitSuccess }: DailyReportModalProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [recipes, setRecipes] = useState<any[]>([])
  const [bulkSaleItems, setBulkSaleItems] = useState<BulkSaleItem[]>([{ menu_id: "", quantity: 0 }])
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [bundlePrice, setBundlePrice] = useState<string>("")
  const [reportDate, setReportDate] = useState(getDefaultOpsDate())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      const load = async () => {
        setIsLoading(true)
        const [mList, iList, rList] = await Promise.all([
          getMenuItems(),
          getInventory(),
          getAllMenuRecipes()
        ])
        setMenuItems(mList.filter(m => m.status === "active"))
        setInventory(iList)
        setRecipes(rList)
        setReportDate(getDefaultOpsDate())
        setIsLoading(false)
      }
      load()
    }
  }, [isOpen])

  // Validation: Check if all ingredients for selected bulk items are available
  const missingIngredients = useMemo(() => {
    const missing: { menuName: string; itemName: string }[] = [];
    const validItems = bulkSaleItems.filter(item => item.menu_id && item.quantity > 0);
    
    validItems.forEach(saleItem => {
      const menu = menuItems.find(m => m.id === saleItem.menu_id);
      if (!menu) return;

      const menuRecipes = recipes.filter(r => r.menu_item_id === saleItem.menu_id);
      menuRecipes.forEach(recipe => {
        const invItem = inventory.find(i => i.id === recipe.inventory_item_id);
        const hasStock = invItem && (invItem.stock || invItem.current_stock || 0) > 0;

        if (!hasStock) {
          missing.push({
            menuName: menu.name,
            itemName: invItem?.name || "Unknown Ingredient"
          });
        }
      });
    });
    
    return missing;
  }, [bulkSaleItems, recipes, inventory, menuItems]);

  const addRow = () => {
    setBulkSaleItems([...bulkSaleItems, { menu_id: "", quantity: 0 }])
  }

  const removeRow = (index: number) => {
    if (bulkSaleItems.length <= 1) return
    setBulkSaleItems(bulkSaleItems.filter((_, i) => i !== index))
    setSelectedRows(selectedRows.filter(i => i !== index).map(i => i > index ? i - 1 : i))
  }

  const toggleRowSelection = (index: number) => {
    if (selectedRows.includes(index)) {
      setSelectedRows(selectedRows.filter(i => i !== index))
    } else {
      setSelectedRows([...selectedRows, index])
    }
  }

  const applyBundlePrice = () => {
    const totalBundle = parseFloat(bundlePrice)
    if (isNaN(totalBundle) || selectedRows.length < 2) return

    const updated = [...bulkSaleItems]
    
    const selectedItemsData = selectedRows.map(idx => {
      const item = updated[idx]
      const menu = menuItems.find(m => m.id === item.menu_id)
      return { idx, normalPrice: (menu?.price || 0) * (item.quantity || 1) }
    })

    const combinedNormalTotal = selectedItemsData.reduce((sum, item) => sum + item.normalPrice, 0)
    
    selectedItemsData.forEach(item => {
      const ratio = combinedNormalTotal > 0 ? item.normalPrice / combinedNormalTotal : 1 / selectedRows.length
      updated[item.idx].total_price = Math.round(totalBundle * ratio)
    })

    setBulkSaleItems(updated)
    setBundlePrice("")
    setSelectedRows([])
  }

  const updateItem = (index: number, field: keyof BulkSaleItem | "discount", value: string | number) => {
    const updated = [...bulkSaleItems]
    
    if (field === "menu_id") {
      updated[index].menu_id = value as string
      updated[index].total_price = undefined
    } else if (field === "quantity") {
      updated[index].quantity = typeof value === "string" ? parseInt(value, 10) || 0 : value
    } else if (field === "total_price") {
      updated[index].total_price = typeof value === "string" ? parseFloat(value) || 0 : value
    } else if (field === "discount") {
      const menu = menuItems.find(m => m.id === updated[index].menu_id)
      if (menu) {
        const discountPercent = typeof value === "string" ? parseFloat(value) || 0 : value
        const subtotal = menu.price * updated[index].quantity
        updated[index].total_price = subtotal * (1 - discountPercent / 100)
      }
    }
    
    setBulkSaleItems(updated)
  }

  const handleSubmit = async () => {
    const validItems = bulkSaleItems.filter(item => item.menu_id && item.quantity > 0)
    if (validItems.length === 0) {
      toast.error("Please add at least one menu item")
      return
    }

    setIsSubmitting(true)
    const success = await bulkSellMenu(validItems, reportDate)
    
    if (success) {
      toast.success("Daily report submitted successfully")
      setBulkSaleItems([{ menu_id: "", quantity: 0 }])
      onSubmitSuccess()
    } else {
      toast.error("Failed to submit report. Please check stock availability.")
    }
    setIsSubmitting(false)
  }

  const totalRevenue = bulkSaleItems.reduce((sum, item) => {
    if (item.total_price !== undefined) return sum + item.total_price
    const menu = menuItems.find(m => m.id === item.menu_id)
    return sum + (menu ? menu.price * item.quantity : 0)
  }, 0)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-sm">
            <ShoppingCart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight">Daily Sales Report</h2>
            <p className="text-sm text-muted-foreground">Input all sales for the selected date.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           {/* Date Picker - Styled for Ops */}
           <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Report Date</span>
              <div className="flex items-center gap-2 bg-muted p-2 rounded-sm border">
                <CalendarDays className="w-4 h-4 text-primary" />
                <Input 
                  type="date" 
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="h-6 w-32 border-none bg-transparent text-xs p-0 focus-visible:ring-0 font-bold"
                />
              </div>
              {/* Shift info info for barista */}
              {new Date().getHours() < 4 && reportDate === getDefaultOpsDate() && (
                <span className="text-[9px] font-bold text-amber-600 uppercase tracking-tighter animate-pulse">
                  Night Shift (Report for Yesterday)
                </span>
              )}
           </div>
           
           <Button variant="ghost" size="icon" onClick={onClose} className="h-12 w-12 hover:bg-muted">
             <X className="w-6 h-6" />
           </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Bundling Instruction Hint */}
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/10 rounded-sm text-[11px] text-primary/80 font-medium">
              <Layers className="w-3.5 h-3.5" />
              <span>PRO TIP: Select multiple items using the checkboxes on the left to group them into a Bundle.</span>
            </div>

            {bulkSaleItems.map((item, idx) => {
              const selectedMenu = menuItems.find(m => m.id === item.menu_id)
              const subtotal = selectedMenu ? selectedMenu.price * item.quantity : 0
              const isOverridden = item.total_price !== undefined
              const discountPercent = subtotal > 0 ? ((subtotal - (item.total_price ?? subtotal)) / subtotal) * 100 : 0
              const isSelectedForBundle = selectedRows.includes(idx)
              
              return (
                <div key={idx} className={cn(
                  "flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-sm border transition-all",
                  isSelectedForBundle ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/50"
                )}>
                  {/* Selection Checkbox */}
                  <div 
                    className={cn(
                      "w-12 h-12 -ml-1 rounded-sm border flex items-center justify-center cursor-pointer transition-all active:scale-90",
                      isSelectedForBundle ? "bg-primary border-primary text-white" : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                    onClick={() => toggleRowSelection(idx)}
                  >
                    {isSelectedForBundle ? <Check className="w-6 h-6" /> : <div className="w-2 h-2 rounded-full bg-border" />}
                  </div>
                  {/* Menu Selection */}
                  <div className="flex-1 min-w-[250px]">
                    <Select value={item.menu_id} onValueChange={(v) => updateItem(idx, "menu_id", v)}>
                      <SelectTrigger className="bg-background border-none h-12 text-base">
                        <SelectValue placeholder="Select Menu" />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {menuItems.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name} (Rp {m.price.toLocaleString()})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantity */}
                  <div className="w-24">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase px-1">QTY</span>
                      <Input 
                        type="number" 
                        value={item.quantity || ""} 
                        onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                        className="h-12 text-center text-lg font-bold"
                      />
                    </div>
                  </div>

                  {/* Discount % */}
                  <div className="w-20">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase px-1">Disc %</span>
                      <div className="relative">
                        <Input 
                          type="number" 
                          placeholder="0"
                          value={discountPercent > 0 ? Math.round(discountPercent) : ""}
                          onChange={(e) => updateItem(idx, "discount", e.target.value)}
                          className="h-12 pl-2 pr-6 text-center"
                        />
                        <Percent className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>
                  </div>

                  {/* Total Price */}
                  <div className="w-40">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase px-1">Price</span>
                      <div className="relative">
                        <Tag className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", isOverridden ? "text-primary" : "text-muted-foreground")} />
                        <Input 
                          type="number" 
                          placeholder={subtotal.toString()}
                          value={isOverridden ? item.total_price : ""}
                          onChange={(e) => updateItem(idx, "total_price", e.target.value)}
                          className={cn("h-12 pl-8 text-right font-mono", isOverridden && "text-primary font-bold")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center pt-5">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeRow(idx)}
                      disabled={bulkSaleItems.length <= 1}
                      className="h-12 w-12 text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                    >
                      <Minus className="w-6 h-6" />
                    </Button>
                  </div>
                </div>
              )
            })}

            <Button variant="outline" onClick={addRow} className="w-full h-14 border-dashed border-2 rounded-sm text-lg gap-2">
              <Plus className="w-5 h-5" />
              Add More Menu
            </Button>

            {selectedRows.length >= 2 && (
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <div className="bg-primary text-white p-2 rounded-sm">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary uppercase">Bundling Helper</p>
                    <p className="text-xs text-muted-foreground">{selectedRows.length} items selected to group as a bundle</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">Rp</span>
                    <Input 
                      type="number"
                      placeholder="Bundle Total"
                      value={bundlePrice}
                      onChange={(e) => setBundlePrice(e.target.value)}
                      className="w-40 h-12 pl-8 rounded-sm bg-background border-primary/30 focus-visible:ring-primary text-lg"
                    />
                  </div>
                  <Button 
                    onClick={applyBundlePrice} 
                    disabled={!bundlePrice}
                    className="h-12 px-6 rounded-sm shadow-sm"
                  >
                    Apply Bundle
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Summary */}
      <div className="p-6 border-t bg-muted/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Total Revenue</span>
            <span className="text-4xl font-bold text-primary">Rp {totalRevenue.toLocaleString()}</span>
            
            {missingIngredients.length > 0 && (
              <div className="flex flex-col gap-1 mt-2">
                {Array.from(new Set(missingIngredients.map(m => m.itemName))).map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-destructive uppercase animate-pulse">
                    <AlertCircle className="w-3 h-3" />
                    Stock Missing: {item}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <Button variant="outline" onClick={onClose} className="h-16 px-8 text-lg rounded-sm">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || bulkSaleItems.every(i => !i.menu_id || !i.quantity) || missingIngredients.length > 0}
              className={cn(
                "h-16 px-12 text-xl font-bold rounded-sm transition-all",
                missingIngredients.length > 0 ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary hover:bg-primary/90"
              )}
            >
              {isSubmitting ? "Processing..." : missingIngredients.length > 0 ? "Stock Missing" : "Submit Daily Report"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
