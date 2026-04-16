"use client"

import { useState, useEffect } from "react"
import { 
  getMenuItems,
  getSalesReport,
  getSalesLogsGroupedByDate,
  bulkSellMenu,
  getInventory,
  subscribeToSalesLogs,
  subscribeToInventoryItems,
  type MenuItem,
  type SalesReport,
  type SalesLogGrouped,
  type InventoryItem,
  type BulkSaleItem
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  ShoppingCart
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function ReportPage() {
  // Data state
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [salesReport, setSalesReport] = useState<SalesReport[]>([])
  const [salesLogsGrouped, setSalesLogsGrouped] = useState<SalesLogGrouped[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  
  // Daily Sales Input state (bulk sell)
  const [bulkSaleItems, setBulkSaleItems] = useState<BulkSaleItem[]>([{ menu_id: "", quantity: 0 }])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    const [menuData, reportData, logsGroupedData, inventoryData] = await Promise.all([
      getMenuItems(),
      getSalesReport(),
      getSalesLogsGroupedByDate(),
      getInventory()
    ])
    setMenuItems(menuData)
    setSalesReport(reportData)
    setSalesLogsGrouped(logsGroupedData)
    setInventory(inventoryData)
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
    
    return () => {
      unsubSalesLogs()
      unsubInventory()
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

  // Bulk Sale handlers
  const addBulkSaleRow = () => {
    setBulkSaleItems([...bulkSaleItems, { menu_id: "", quantity: 0 }])
  }
  
  const removeBulkSaleRow = (index: number) => {
    if (bulkSaleItems.length <= 1) return
    setBulkSaleItems(bulkSaleItems.filter((_, i) => i !== index))
  }
  
  const updateBulkSaleItem = (index: number, field: keyof BulkSaleItem, value: string | number) => {
    const updated = [...bulkSaleItems]
    if (field === "menu_id") {
      updated[index].menu_id = value as string
    } else {
      updated[index].quantity = typeof value === "string" ? parseInt(value, 10) || 0 : value
    }
    setBulkSaleItems(updated)
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
    
    const result = await bulkSellMenu(validItems)
    
    if (!result) {
      setError("Failed to process sales. Please check stock availability.")
      setIsSubmitting(false)
      return
    }
    
    // Success - reset form
    setBulkSaleItems([{ menu_id: "", quantity: 0 }])
    setIsSubmitting(false)
    // No fetchData() - realtime subscription will update UI
  }

  // Calculate estimated total for bulk sale
  const bulkSaleTotal = bulkSaleItems.reduce((sum, item) => {
    const menu = menuItems.find(m => m.id === item.menu_id)
    return sum + (menu ? menu.price * item.quantity : 0)
  }, 0)

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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Daily Sales Input
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Record multiple menu sales at once. Select menus and enter quantities.
          </p>
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
              const itemTotal = selectedMenu ? selectedMenu.price * item.quantity : 0
              return (
                <div key={idx} className="flex items-center gap-2">
                  <Select 
                    value={item.menu_id} 
                    onValueChange={(v) => updateBulkSaleItem(idx, "menu_id", v)}
                  >
                    <SelectTrigger className="flex-1 rounded-sm">
                      <SelectValue placeholder="Select menu" />
                    </SelectTrigger>
                    <SelectContent>
                      {menuItems.filter(m => m.status === "active").map((menu) => (
                        <SelectItem key={menu.id} value={menu.id}>
                          {menu.name} - {formatPrice(menu.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity || ""}
                    onChange={(e) => updateBulkSaleItem(idx, "quantity", e.target.value)}
                    className="w-24 rounded-sm"
                  />
                  <span className="text-sm text-muted-foreground w-28 text-right font-mono">
                    {formatPrice(itemTotal)}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 text-destructive shrink-0"
                    onClick={() => removeBulkSaleRow(idx)}
                    disabled={bulkSaleItems.length <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                </div>
              )
            })}
          </div>
          
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={addBulkSaleRow} className="rounded-sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Menu
            </Button>
            
            <div className="flex items-center gap-4">
              {bulkSaleTotal > 0 && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Estimated Total</p>
                  <p className="text-lg font-semibold">{formatPrice(bulkSaleTotal)}</p>
                </div>
              )}
              <Button 
                onClick={handleBulkSell} 
                disabled={isSubmitting || bulkSaleItems.every(i => !i.menu_id || !i.quantity)}
                className="rounded-sm"
              >
                {isSubmitting ? "Processing..." : "Submit Sales"}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Report */}
        <Card className="rounded-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Sales by Menu
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
                      <td className="py-3 px-4 font-medium">Total</td>
                      <td className="py-3 px-4 text-right font-mono font-medium">{totalItemsSold}</td>
                      <td className="py-3 px-4 text-right font-mono font-medium">{formatPrice(totalRevenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No sales data yet</p>
                <p className="text-sm text-muted-foreground mt-1">Start selling to see reports here</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventory Impact - Stock Used */}
        <Card className="rounded-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Inventory Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inventory.length > 0 ? (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground bg-card">Item</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground bg-card">Current Stock</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground bg-card">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => {
                      const stock = item.stock || item.current_stock || 0
                      const status = stock <= 0 ? "critical" : stock <= 10 ? "warning" : "healthy"
                      return (
                        <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4 font-medium">{item.name}</td>
                          <td className="py-3 px-4 text-right font-mono">
                            {stock} {item.unit}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={cn(
                              "inline-block px-3 py-1 rounded-sm text-xs font-medium capitalize",
                              status === "healthy" && "bg-[var(--status-healthy)]/10 text-[var(--status-healthy)]",
                              status === "warning" && "bg-[var(--status-warning)]/10 text-[var(--status-warning)]",
                              status === "critical" && "bg-[var(--status-critical)]/10 text-[var(--status-critical)]"
                            )}>
                              {status}
                            </span>
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
