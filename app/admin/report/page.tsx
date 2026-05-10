"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  getMenuItems,
  getSalesReport,
  getSalesLogsGroupedByDate,
  bulkSellMenu,
  getInventory,
  getBatches,
  getAllMenuRecipes,
  fromBaseUnit,
  subscribeToSalesLogs,
  subscribeToInventoryItems,
  subscribeToInventoryBatches,
  getMonthlyOpex,
  addMonthlyOpex,
  deleteMonthlyOpex,
  type MenuItem,
  type SalesReport,
  type SalesLogGrouped,
  type InventoryItem,
  type BulkSaleItem,
  type DisplayUnit
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format, startOfMonth } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Receipt, 
  DollarSign, 
  Package, 
  TrendingUp, 
  Coffee, 
  Clock, 
  CalendarDays, 
  Plus, 
  Minus, 
  ShoppingCart,
  ArrowDownToLine,
  BarChart3,
  PieChart as PieIcon,
  Percent,
  Tag,
  BoxSelect,
  Check,
  Layers,
  History,
  Trash2
} from "lucide-react"
import { cn, getLocalYYYYMMDD } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { useAuth } from "@/lib/auth-context"

export default function ReportPage() {
  // Data state
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [salesReport, setSalesReport] = useState<SalesReport[]>([])
  const [salesLogsGrouped, setSalesLogsGrouped] = useState<SalesLogGrouped[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [recipes, setRecipes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { isSuperAdmin, user } = useAuth()
  
  // Permission check: Super Admin & Admin = full access
  const canEdit = isSuperAdmin() || user?.role === 'admin'
  const [error, setError] = useState("")
  
  // Daily Sales Input state (bulk sell)
  const [bulkSaleItems, setBulkSaleItems] = useState<BulkSaleItem[]>([{ menu_id: "", quantity: 0 }])
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [bundlePrice, setBundlePrice] = useState<string>("")
  const [bulkSaleDate, setBulkSaleDate] = useState(getLocalYYYYMMDD())
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Expenditure State
  const [opex, setOpex] = useState<any[]>([])
  const [expenseForm, setExpenseForm] = useState({ category: "", amount: "", notes: "" })
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    const [menuData, reportData, logsGroupedData, inventoryData, recipeData, batchData, opexData] = await Promise.all([
      getMenuItems(),
      getSalesReport(),
      getSalesLogsGroupedByDate(),
      getInventory(),
      getAllMenuRecipes(),
      getBatches(),
      getMonthlyOpex()
    ])
    setMenuItems(menuData)
    setSalesReport(reportData)
    setSalesLogsGrouped(logsGroupedData)
    setInventory(inventoryData)
    setRecipes(recipeData)
    setBatches(batchData)
    setOpex(opexData)
    setIsLoading(false)
  }

  // Realtime subscriptions - update UI only, no full page reload
  useEffect(() => {
    fetchData()
    
    // Subscribe to sales_logs changes - update only affected data
    const unsubSalesLogs = subscribeToSalesLogs(() => {
      // Refetch sales data only (no full page reload)
      getSalesReport().then(setSalesReport)
      getSalesLogsGroupedByDate().then(setSalesLogsGrouped)
    })
    
    // Subscribe to inventory_items changes (for inventory impact display)
    const unsubInventory = subscribeToInventoryItems(() => {
      getInventory().then(setInventory)
    })

    const unsubInventoryBatches = subscribeToInventoryBatches(() => {
      getBatches().then(setBatches)
    })
    
    return () => {
      unsubSalesLogs()
      unsubInventory()
      unsubInventoryBatches()
    }
  }, [])

  // Format price in IDR
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  // Calculate summary metrics
  const totalRevenue = salesReport.reduce((sum, r) => sum + r.revenue, 0)
  const totalItemsSold = salesReport.reduce((sum, r) => sum + r.total_sold, 0)
  const topSellingMenu = salesReport.length > 0 
    ? salesReport.reduce((top, curr) => curr.total_sold > top.total_sold ? curr : top)
    : null

  const revenueDistribution = useMemo(() => {
    return salesReport
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(s => ({ name: s.menu_name, value: s.revenue }))
  }, [salesReport])

  // Bulk Sale handlers
  const addBulkSaleRow = () => {
    setBulkSaleItems([...bulkSaleItems, { menu_id: "", quantity: 0 }])
  }
  
  const removeBulkSaleRow = (index: number) => {
    if (bulkSaleItems.length <= 1) return
    setBulkSaleItems(bulkSaleItems.filter((_, i) => i !== index))
    setSelectedRows(selectedRows.filter(i => i !== index).map(i => i > index ? i - 1 : i))
  }
  
  const updateBulkSaleItem = (index: number, field: keyof BulkSaleItem | "discount", value: string | number) => {
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
  
  // Handle bulk sell submission
  const handleBulkSell = async () => {
    const validItems = bulkSaleItems.filter(item => item.menu_id && item.quantity > 0)
    if (validItems.length === 0) {
      setError("Please add at least one menu item with quantity")
      return
    }
    
    setIsSubmitting(true)
    setError("")
    
    const result = await bulkSellMenu(validItems, bulkSaleDate)
    
    if (!result) {
      setError("Failed to process sales. Please check stock availability.")
      setIsSubmitting(false)
      return
    }
    
    // Success - reset form
    setBulkSaleItems([{ menu_id: "", quantity: 0 }])
    setIsSubmitting(false)
    
    // Auto-refresh the page data so changes reflect immediately
    fetchData()
  }

  // Calculate estimated total for bulk sale
  const bulkSaleTotal = bulkSaleItems.reduce((sum, item) => {
    if (item.total_price !== undefined) {
      return sum + item.total_price
    }
    const menu = menuItems.find(m => m.id === item.menu_id)
    return sum + (menu ? menu.price * item.quantity : 0)
  }, 0)

  // Expense Handlers
  const handleSaveExpense = async () => {
    if (!expenseForm.category || !expenseForm.amount) return
    setIsSubmittingExpense(true)
    try {
      await addMonthlyOpex({
        month: bulkSaleDate.substring(0, 7), // Use the date from calendar
        category: expenseForm.category,
        amount: parseFloat(expenseForm.amount),
        notes: expenseForm.notes,
        created_at: `${bulkSaleDate}T12:00:00Z` // Force the date to the selected date
      })
      toast.success("Expense recorded for " + bulkSaleDate)
      setExpenseForm({ category: "", amount: "", notes: "" })
      fetchData()
    } catch (err) {
      toast.error("Failed to record expense")
    } finally {
      setIsSubmittingExpense(false)
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Delete this expense?")) return
    try {
      await deleteMonthlyOpex(id)
      toast.success("Expense deleted")
      fetchData()
    } catch (err) {
      toast.error("Failed to delete")
    }
  }

  // Calculate Expenses for the selected date
  const todayDate = getLocalYYYYMMDD()
  const selectedExpenses = useMemo(() => {
    return opex.filter(o => {
      const createdAtDate = o.created_at?.split('T')[0]
      return createdAtDate === bulkSaleDate
    }).reduce((sum, o) => sum + o.amount, 0)
  }, [opex, bulkSaleDate])

  const selectedIncomeData = useMemo(() => {
    const group = salesLogsGrouped.find(g => g.date === bulkSaleDate)
    return {
      revenue: group ? group.logs.reduce((sum, log) => sum + (log.total_price || 0), 0) : 0,
      count: group ? group.logs.reduce((sum, log) => sum + log.quantity, 0) : 0
    }
  }, [salesLogsGrouped, bulkSaleDate])
  // Calculate consumption directly from TODAY'S SALES and RECIPES.
  // This ensures consumption reflects actual usage today, regardless of batch boundaries.
  const inventoryConsumption = useMemo(() => {
    const consumption: Record<string, number> = {}
    
    // Find today's logs from the grouped logs
    const today = getLocalYYYYMMDD()
    const todayGroup = salesLogsGrouped.find(g => g.date === today)
    const allDates = salesLogsGrouped.map(g => g.date)
    
    console.log("[DEBUG CONSUMPTION V3]", {
      today,
      allDates,
      foundTodayGroup: !!todayGroup,
      todaySalesCount: todayGroup?.logs?.length || 0,
      menuItemsCount: menuItems.length
    })

    if (todayGroup) {
      // Aggregate today's sales by menu_id
      const todaySales: Record<string, number> = {}
      todayGroup.logs.forEach(log => {
        todaySales[log.menu_id] = (todaySales[log.menu_id] || 0) + log.quantity
      })

      console.log("[DEBUG CONSUMPTION V3] todaySales:", todaySales)

      // Calculate consumption based on recipes
      Object.entries(todaySales).forEach(([menuId, totalSold]) => {
        const menu = menuItems.find(m => m.id === menuId)
        
        console.log(`[DEBUG CONSUMPTION V3] menu ${menuId} (${menu?.name}):`, {
          hasRecipe: !!menu?.recipe,
          ingredientsCount: menu?.recipe?.ingredients?.length || 0
        })

        if (menu?.recipe?.ingredients) {
          menu.recipe.ingredients.forEach((ing: any) => {
            const totalUsed = totalSold * ing.amount
            consumption[ing.item_id] = (consumption[ing.item_id] || 0) + totalUsed
          })
        }
      })
    }
    
    console.log("[DEBUG CONSUMPTION V3] final consumption:", consumption)
    return consumption
  }, [salesLogsGrouped, menuItems])

  // Validation: Check if all ingredients for selected bulk items are available/opened on floor
  const missingIngredients = useMemo(() => {
    // Only validate ingredients if we are recording for TODAY
    const isToday = bulkSaleDate === getLocalYYYYMMDD();
    if (!isToday) return [];

    const missing: { menuName: string; itemName: string }[] = [];
    const validItems = bulkSaleItems.filter(item => item.menu_id && item.quantity > 0);
    
    validItems.forEach(saleItem => {
      const menu = menuItems.find(m => m.id === saleItem.menu_id);
      if (!menu) return;

      const menuRecipes = recipes.filter(r => r.menu_item_id === saleItem.menu_id);
      menuRecipes.forEach(recipe => {
        // Check if there is ANY opened/active batch for this ingredient on the FLOOR
        const hasOpenedBatch = batches.some(b => 
          (b.item_id === recipe.inventory_item_id || b.inventoryItemId === recipe.inventory_item_id) && 
          b.is_opened && 
          (b.remaining_quantity || b.currentQuantity || 0) > 0
        );

        if (!hasOpenedBatch) {
          const invItem = inventory.find(i => i.id === recipe.inventory_item_id);
          missing.push({
            menuName: menu.name,
            itemName: invItem?.name || "Unknown Ingredient"
          });
        }
      });
    });
    
    return missing;
  }, [bulkSaleItems, recipes, batches, menuItems, inventory]);

  // Colors for PieChart
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#0088FE', '#00C49F', '#FFBB28', '#FF8042']

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
        <h1 className="text-3xl font-light tracking-tight">Report</h1>
        <p className="text-muted-foreground">Daily operations, sales, and expenses</p>
      </header>

      {/* Unified Statistics Header - Premium Glassmorphism Style */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* Today's Focus */}
        <Card className="lg:col-span-3 rounded-sm border-none shadow-sm bg-gradient-to-br from-background to-muted/30 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Clock className="w-24 h-24" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Live Performance: {bulkSaleDate === todayDate ? "Today" : bulkSaleDate}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-tight mb-1">Income</span>
                <span className="text-3xl font-bold tracking-tight text-emerald-700">{formatPrice(selectedIncomeData.revenue)}</span>
                <span className="text-[10px] text-muted-foreground mt-1 font-medium">{selectedIncomeData.count} items sold</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-rose-600/70 uppercase tracking-tight mb-1">Expenses</span>
                <span className="text-3xl font-bold tracking-tight text-rose-700">-{formatPrice(selectedExpenses)}</span>
                <span className="text-[10px] text-muted-foreground mt-1 font-medium">Daily purchases</span>
              </div>
              <div className="flex flex-col border-l border-border/50 pl-8">
                <span className="text-[10px] font-bold text-primary/70 uppercase tracking-tight mb-1">Net Balance</span>
                <span className={cn("text-3xl font-bold tracking-tight", selectedIncomeData.revenue - selectedExpenses >= 0 ? "text-primary" : "text-rose-600")}>
                  {formatPrice(selectedIncomeData.revenue - selectedExpenses)}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1 font-medium italic">Margin status</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Global Context */}
        <Card className="rounded-sm border border-dashed bg-muted/5 shadow-none flex flex-col justify-center p-6 relative overflow-hidden group">
          <div className="absolute -bottom-2 -right-2 opacity-5 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-20 h-20" />
          </div>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">Business Scale</p>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">All-Time Sales</p>
              <p className="text-xl font-bold tracking-tight">{totalItemsSold} <span className="text-xs font-normal">portions</span></p>
            </div>
            <div className="pt-2 border-t border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Top Menu</p>
              <p className="text-xs font-bold truncate text-primary uppercase">{topSellingMenu?.menu_name || "-"}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="sales" className="gap-2"><ShoppingCart className="w-4 h-4" />Sales Input</TabsTrigger>
          <TabsTrigger value="expenditure" className="gap-2"><Receipt className="w-4 h-4" />Expenditure</TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2"><Package className="w-4 h-4" />Inventory Impact</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
      <Card className="rounded-sm mb-8">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Daily Sales Input
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Record multiple menu sales at once. Select menus and enter quantities.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <label 
              className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-sm border shadow-sm cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={(e) => {
                const input = e.currentTarget.querySelector('input');
                if (input && 'showPicker' in input) {
                  try {
                    input.showPicker();
                  } catch (err) {
                    // Fallback for older browsers
                    input.focus();
                  }
                }
              }}
            >
              <CalendarDays className="w-4 h-4 text-muted-foreground ml-1" />
              <Input 
                type="date" 
                value={bulkSaleDate} 
                max={getLocalYYYYMMDD()}
                onChange={(e) => setBulkSaleDate(e.target.value)}
                className="h-7 w-32 border-none bg-transparent text-xs p-0 focus-visible:ring-0 font-bold cursor-pointer"
                onClick={(e) => e.stopPropagation()} // Prevent double trigger
              />
            </label>
            {bulkSaleDate !== getLocalYYYYMMDD() && (
              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] uppercase font-bold animate-pulse">
                Historical Entry (No Inventory Deduction)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-sm mb-4">
              {error}
            </div>
          )}
          
          <div className="space-y-3 mb-4">
            {bulkSaleItems.map((item, idx) => {
              const selectedMenu = menuItems.find(m => m.id === item.menu_id)
              const subtotal = selectedMenu ? selectedMenu.price * item.quantity : 0
              const isOverridden = item.total_price !== undefined
              const currentTotal = isOverridden ? item.total_price : subtotal
              const discountPercent = subtotal > 0 ? ((subtotal - (item.total_price ?? subtotal)) / subtotal) * 100 : 0
              const isSelectedForBundle = selectedRows.includes(idx)

              return (
                <div key={idx} className={cn(
                  "flex flex-wrap items-center gap-2 p-2 rounded-sm border transition-all",
                  isSelectedForBundle ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-muted/5"
                )}>
                  <div 
                    className={cn(
                      "w-10 h-10 -ml-1 rounded-sm border flex items-center justify-center cursor-pointer transition-all active:scale-90",
                      isSelectedForBundle ? "bg-primary border-primary text-white" : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                    onClick={() => toggleRowSelection(idx)}
                  >
                    {isSelectedForBundle ? <Check className="w-5 h-5" /> : <div className="w-2 h-2 rounded-full bg-border" />}
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <Select 
                      value={item.menu_id} 
                      onValueChange={(v) => updateBulkSaleItem(idx, "menu_id", v)}
                    >
                      <SelectTrigger className="w-full rounded-sm border-none bg-transparent shadow-none hover:bg-muted/30">
                        <SelectValue placeholder="Select menu" />
                      </SelectTrigger>
                      <SelectContent>
                        {menuItems.filter(m => m.status === "active").map((menu) => (
                          <SelectItem key={menu.id} value={menu.id}>
                            {menu.name} ({formatPrice(menu.price)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1 bg-background/50 rounded-sm border border-border/50 px-2 h-9">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Qty</span>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity || ""}
                      onChange={(e) => updateBulkSaleItem(idx, "quantity", e.target.value)}
                      className="w-12 h-6 p-0 border-none bg-transparent shadow-none text-center focus-visible:ring-0"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-background/50 rounded-sm border border-border/50 px-2 h-9">
                    <Percent className="w-3 h-3 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="%"
                      value={discountPercent > 0 ? Math.round(discountPercent) : ""}
                      onChange={(e) => updateBulkSaleItem(idx, "discount", e.target.value)}
                      className="w-8 h-6 p-0 border-none bg-transparent shadow-none text-center focus-visible:ring-0 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-background/50 rounded-sm border border-border/50 px-2 h-9 group">
                    <Tag className={cn("w-3 h-3", isOverridden ? "text-primary" : "text-muted-foreground")} />
                    <Input
                      type="number"
                      placeholder={formatPrice(subtotal)}
                      value={isOverridden ? item.total_price : ""}
                      onChange={(e) => updateBulkSaleItem(idx, "total_price", e.target.value)}
                      className={cn(
                        "w-28 h-6 p-0 border-none bg-transparent shadow-none text-right focus-visible:ring-0 font-mono text-sm",
                        isOverridden && "text-primary font-bold"
                      )}
                    />
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <span className={cn(
                      "text-sm font-mono whitespace-nowrap min-w-[100px] text-right",
                      isOverridden ? "text-primary" : "text-foreground"
                    )}>
                      {formatPrice(currentTotal ?? 0)}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/10 rounded-sm"
                      onClick={() => removeBulkSaleRow(idx)}
                      disabled={bulkSaleItems.length <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {selectedRows.length >= 2 && (
            <div className="bg-primary/10 border border-primary/20 p-3 rounded-sm mb-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="bg-primary text-white p-1.5 rounded-sm">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary uppercase">Bundling Helper</p>
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
                    className="w-32 h-9 pl-8 rounded-sm bg-background border-primary/30 focus-visible:ring-primary"
                  />
                </div>
                <Button 
                  size="sm" 
                  onClick={applyBundlePrice} 
                  disabled={!bundlePrice}
                  className="rounded-sm shadow-sm"
                >
                  Apply Bundle
                </Button>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Button variant="outline" onClick={addBulkSaleRow} className="rounded-sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Menu
              </Button>
              {missingIngredients.length > 0 && (
                <div className="flex flex-col gap-1 mt-2">
                  {Array.from(new Set(missingIngredients.map(m => m.itemName))).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-destructive uppercase animate-pulse">
                      <Package className="w-3 h-3" />
                      Must Open Batch: {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              {bulkSaleTotal > 0 && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Estimated Total</p>
                  <p className="text-lg font-semibold">{formatPrice(bulkSaleTotal)}</p>
                </div>
              )}
              <Button 
                onClick={handleBulkSell} 
                disabled={isSubmitting || bulkSaleItems.every(i => !i.menu_id || !i.quantity) || missingIngredients.length > 0}
                className={cn(
                  "rounded-sm",
                  missingIngredients.length > 0 ? "bg-muted text-muted-foreground cursor-not-allowed" : ""
                )}
              >
                {isSubmitting ? "Processing..." : missingIngredients.length > 0 ? "Stock Missing" : "Submit Sales"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Sales Summary Table */}
        <Card className="rounded-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-tight">
              <Receipt className="w-4 h-4" /> All-Time Best Sellers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesReport.length > 0 ? (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto pr-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-3 font-medium">Menu</th>
                      <th className="text-right py-3 font-medium">Qty</th>
                      <th className="text-right py-3 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesReport.sort((a,b) => b.total_sold - a.total_sold).map((report) => (
                      <tr key={report.menu_id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 font-medium">{report.menu_name}</td>
                        <td className="py-3 text-right font-mono">{report.total_sold}</td>
                        <td className="py-3 text-right font-mono">{formatPrice(report.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-xs text-muted-foreground italic py-8 text-center">No sales data yet</p>}
          </CardContent>
        </Card>

        {/* Detailed History */}
        <Card className="rounded-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-tight">
              <CalendarDays className="w-4 h-4" /> History per Transaction
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesLogsGrouped.length > 0 ? (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {salesLogsGrouped.slice(0, 15).map((group) => (
                  <div key={group.date} className="p-4 border rounded-sm bg-muted/5 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/30">
                      <span className="text-[11px] font-bold uppercase tracking-wider">{group.date}</span>
                      <span className="text-[11px] font-mono font-bold text-primary">{formatPrice(group.total_revenue)}</span>
                    </div>
                    <div className="space-y-2">
                      {group.logs.map((l, i) => (
                        <div key={i} className="flex justify-between items-center text-[11px]">
                          <span className="text-muted-foreground">{l.menu_name}</span>
                          <div className="flex gap-4">
                            <span className="font-bold">x{l.quantity}</span>
                            <span className="font-mono text-muted-foreground/80 w-24 text-right">{formatPrice(l.total_price)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground italic py-8 text-center">No history data</p>}
          </CardContent>
        </Card>
      </div>
    </TabsContent>

        <TabsContent value="expenditure">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <Card className="rounded-sm lg:col-span-1 border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-tight">
                    <Plus className="w-4 h-4" /> Record Purchase
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Category</Label>
                      <Select 
                        onValueChange={(val) => setExpenseForm(p => ({ ...p, category: val }))}
                        value={expenseForm.category}
                      >
                        <SelectTrigger className="h-9 rounded-sm">
                          <SelectValue placeholder="Select category..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Supplies (Tissue, Cleaning, etc.)">Supplies (Tissue, etc.)</SelectItem>
                          <SelectItem value="Maintenance">Maintenance / Equipment</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Amount (IDR)</Label>
                      <Input 
                        type="number" 
                        placeholder="e.g. 50000" 
                        className="h-9 rounded-sm"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Notes / Item Name</Label>
                      <Input 
                        placeholder="e.g. Beli Sapu & Pel" 
                        className="h-9 rounded-sm"
                        value={expenseForm.notes}
                        onChange={(e) => setExpenseForm(p => ({ ...p, notes: e.target.value }))}
                      />
                    </div>
                    <Button 
                      className="w-full rounded-sm font-bold uppercase tracking-widest text-[10px] h-10" 
                      onClick={handleSaveExpense}
                      disabled={isSubmittingExpense || !expenseForm.category || !expenseForm.amount}
                    >
                      {isSubmittingExpense ? "Saving..." : "Record Expense"}
                    </Button>
                  </div>
                </CardContent>
             </Card>

             <Card className="rounded-sm lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-tight">
                    <History className="w-4 h-4" /> Today's Expense Logs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                   <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr className="text-[10px] uppercase font-bold text-muted-foreground text-left">
                            <th className="py-2">Category</th>
                            <th className="py-2">Notes</th>
                            <th className="py-2 text-right">Amount</th>
                            <th className="py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {opex.filter(o => o.created_at?.split('T')[0] === bulkSaleDate).length === 0 ? (
                            <tr><td colSpan={4} className="py-8 text-center text-muted-foreground italic">No expenses recorded for this date</td></tr>
                          ) : (
                            opex.filter(o => o.created_at?.split('T')[0] === bulkSaleDate).map(o => (
                              <tr key={o.id} className="border-b last:border-0">
                                <td className="py-3 font-medium text-xs">{o.category}</td>
                                <td className="py-3 text-xs text-muted-foreground italic">{o.notes || '-'}</td>
                                <td className="py-3 text-right font-mono font-bold">{formatPrice(o.amount)}</td>
                                <td className="py-3 text-right">
                                   <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/50 hover:text-destructive" onClick={() => handleDeleteExpense(o.id)}>
                                     <Trash2 className="w-3.5 h-3.5" />
                                   </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                   </div>
                </CardContent>
             </Card>
           </div>
        </TabsContent>

        <TabsContent value="inventory">
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-sm mb-6 flex items-start gap-4">
            <div className="bg-amber-500 text-white p-2 rounded-sm shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-700 uppercase tracking-tight">Apa itu Inventory Impact?</p>
              <p className="text-xs text-amber-600/80 leading-relaxed mt-1">
                Angka di bawah ini adalah <strong>prediksi pemakaian bahan baku</strong> berdasarkan jumlah menu yang laku hari ini. 
                Sistem menghitung otomatis sesuai resep (misal: 1 Kopi = 18g Biji Kopi). Ini membantu Anda memantau sisa stok di meja Bar tanpa harus menimbang manual setiap saat.
              </p>
            </div>
          </div>

      {/* Data Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sales Chart */}
        <Card className="rounded-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="w-4 h-4 text-primary" />
              Sales Volume by Menu
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            {salesReport.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={salesReport.sort((a,b) => b.total_sold - a.total_sold).slice(0, 8)} 
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} opacity={0.3} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="menu_name" 
                    type="category" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    width={120}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="total_sold" fill="#1a1a1a" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/20 border border-dashed border-border rounded-sm">
                <BarChart3 className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm font-medium">No sales data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Distribution Chart */}
        <Card className="rounded-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-primary" />
              Revenue Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {salesReport.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesReport.slice(0, 5)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="revenue"
                    nameKey="menu_name"
                    stroke="none"
                  >
                    {salesReport.slice(0, 5).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      borderRadius: '4px', 
                      border: '1px solid hsl(var(--border))',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => formatPrice(value)}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/20 border border-dashed border-border rounded-sm">
                <PieIcon className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm font-medium">No revenue data yet</p>
                <p className="text-xs">Waiting for completed transactions</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Inventory Impact - Usage Analysis */}
        <Card className="rounded-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Inventory Consumption & Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inventory.length > 0 ? (
              <div className="overflow-x-auto max-h-[450px] overflow-y-auto pr-1">
                <table className="w-full">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                      <th className="text-left py-3 px-4">Item</th>
                      <th className="text-right py-3 px-4">Consumption</th>
                      <th className="text-right py-3 px-4">Current Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory
                      .filter(item => 
                        batches.some(b => (b.item_id === item.id || b.inventoryItemId === item.id) && b.is_opened)
                      )
                      .map((item) => {
                      // CALC: Get only "OPENED" batches for this item (Active Bar Stock)
                      const itemOpenedBatches = batches.filter(b => (b.item_id === item.id || b.inventoryItemId === item.id) && b.is_opened)
                      const activeBarStockBase = itemOpenedBatches.reduce((sum, b) => sum + (b.remaining_quantity || b.currentQuantity || 0), 0)
                      
                      const baseConsumption = inventoryConsumption[item.id] || 0
                      const unitToDisplay = item.unit || "g"
                      
                      // Progress bar reflects active stock against some threshold 
                      const progress = Math.min(100, Math.max(0, (activeBarStockBase / (item.max_stock || 1000)) * 100))
                      const statusColor = activeBarStockBase <= 0 ? "bg-[var(--status-critical)]" : activeBarStockBase <= (item.min_stock || 100) ? "bg-[var(--status-warning)]" : "bg-[var(--status-healthy)]"
                      
                      return (
                        <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-sm">{item.name}</span>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 w-24">
                                  <Progress value={progress} className="h-1" indicatorClassName={statusColor} />
                                </div>
                                <span className="text-[9px] font-bold text-muted-foreground whitespace-nowrap">
                                  {progress.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-sm group">
                            <div className="flex flex-col items-end">
                              <span className={cn(baseConsumption > 0 ? "text-orange-500 font-bold" : "text-muted-foreground")}>
                                {baseConsumption > 0 ? `-${Number(baseConsumption.toFixed(2))}` : '0'} 
                              </span>
                              <span className="text-[10px] text-muted-foreground font-bold">{unitToDisplay}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-mono font-bold text-sm">{Number(activeBarStockBase.toFixed(2))}</span>
                              <span className="text-[10px] text-muted-foreground font-bold">{unitToDisplay}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 bg-muted/20 rounded-sm border border-dashed">
                <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">No active inventory tracked at the bar</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Open a batch in the Inventory module to see live consumption</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  </Tabs>
</div>
  )
}
