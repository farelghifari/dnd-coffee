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
  type MenuItem,
  type SalesReport,
  type SalesLogGrouped,
  type InventoryItem,
  type BulkSaleItem,
  type DisplayUnit
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Layers
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

  const fetchData = async () => {
    setIsLoading(true)
    const [menuData, reportData, logsGroupedData, inventoryData, recipeData, batchData] = await Promise.all([
      getMenuItems(),
      getSalesReport(),
      getSalesLogsGroupedByDate(),
      getInventory(),
      getAllMenuRecipes(),
      getBatches()
    ])
    setMenuItems(menuData)
    setSalesReport(reportData)
    setSalesLogsGrouped(logsGroupedData)
    setInventory(inventoryData)
    setRecipes(recipeData)
    setBatches(batchData)
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

  // Calculate Inventory Consumption based on sales + recipes
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
        <p className="text-muted-foreground">Sales operations and reporting</p>
      </header>

      {/* Daily Sales Input Section */}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="rounded-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatPrice(totalRevenue)}</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Coffee className="w-4 h-4" />
              Total Items Sold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalItemsSold}</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Top Selling Menu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {topSellingMenu ? topSellingMenu.menu_name : "-"}
            </p>
            {topSellingMenu && (
              <p className="text-sm text-muted-foreground">
                {topSellingMenu.total_sold} sold
              </p>
            )}
          </CardContent>
        </Card>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Report Table */}
        <Card className="rounded-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Sales Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesReport.length > 0 ? (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground bg-card">Menu Name</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground bg-card">Qty Sold</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground bg-card">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesReport.map((report) => (
                      <tr key={report.menu_id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 font-medium">{report.menu_name}</td>
                        <td className="py-3 px-4 text-right font-mono">{report.total_sold}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatPrice(report.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-card">
                    <tr className="bg-muted/50">
                      <td className="py-3 px-4 font-medium text-xs uppercase tracking-wider">Total</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">{totalItemsSold}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">{formatPrice(totalRevenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No sales data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

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
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-bold">
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
                      
                      const baseStock = item.stock || item.current_stock || 0
                      const maxStock = item.max_stock || 100 
                      const baseConsumption = inventoryConsumption[item.id] || 0
                      
                      // Values for display - use RAW BASE UNIT (gram/ml) for precision
                      const unitToDisplay = item.unit || "g"
                      const stock = activeBarStockBase
                      const consumption = baseConsumption
                      
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
                              <span className={cn(consumption > 0 ? "text-orange-500 font-bold" : "text-muted-foreground")}>
                                {consumption > 0 ? `-${Number(consumption.toFixed(2))}` : '0'} 
                              </span>
                              <span className="text-[10px] text-muted-foreground font-bold">{unitToDisplay}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-mono font-bold text-sm">{Number(stock.toFixed(2))}</span>
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
              <div className="text-center py-8">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No inventory data</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales Log - Grouped by Date */}
      <Card className="rounded-sm mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Recent Sales (by Date)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {salesLogsGrouped.length > 0 ? (
            <div className="space-y-6 max-h-[500px] overflow-y-auto">
              {salesLogsGrouped.slice(0, 7).map((group) => (
                <div key={group.date}>
                  {/* Date Header */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                    <h4 className="font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      {new Date(group.date).toLocaleDateString("id-ID", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                      })}
                    </h4>
                    <div className="text-right">
                      <p className="text-sm font-medium">{group.total_quantity} items</p>
                      <p className="text-sm text-muted-foreground">{formatPrice(group.total_revenue)}</p>
                    </div>
                  </div>
                  
                  {/* Sales for this date */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Menu</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Qty</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.logs.map((log) => (
                          <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                            <td className="py-2 px-3 text-sm font-medium">{log.menu_name || "Unknown"}</td>
                            <td className="py-2 px-3 text-sm text-right font-mono">{log.quantity}</td>
                            <td className="py-2 px-3 text-sm text-right font-mono">{formatPrice(log.total_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No recent sales</p>
              <p className="text-sm text-muted-foreground mt-1">Use the Daily Sales Input above to record sales</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
