"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  getSalesReport, 
  getInventory,
  getFinancialSummary,
  getMonthlyTarget,
  subscribeToSalesLogs,
  subscribeToInventoryItems,
  type SalesReport,
  type InventoryItem,
  type FinancialSummary,
  type MonthlyTarget
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts"
import {
  DollarSign,
  TrendingUp,
  Coffee,
  Package,
  Calculator,
  Target,
  BarChart3,
  Clock,
  Wallet,
  ArrowUpRight
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

export default function AnalyticsPage() {
  // Data from Supabase
  const [salesReport, setSalesReport] = useState<SalesReport[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [financials, setFinancials] = useState<FinancialSummary | null>(null)
  const [target, setTarget] = useState<MonthlyTarget | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const currentMonth = format(new Date(), "yyyy-MM")
  
  // BEP Manual Input
  const [fixedCost, setFixedCost] = useState("")

  const fetchData = async () => {
    setIsLoading(true)
    const [salesData, inventoryData, finData, targetData] = await Promise.all([
      getSalesReport(),
      getInventory(),
      getFinancialSummary(currentMonth),
      getMonthlyTarget(currentMonth)
    ])
    setSalesReport(salesData)
    setInventory(inventoryData)
    setFinancials(finData)
    setTarget(targetData)
    setIsLoading(false)
  }

  // Realtime subscriptions - update UI only, no full page reload
  useEffect(() => {
    fetchData()
    
    // Subscribe to sales_logs changes
    const unsubSalesLogs = subscribeToSalesLogs(() => {
      getSalesReport().then(setSalesReport)
    })
    
    // Subscribe to inventory_items changes
    const unsubInventory = subscribeToInventoryItems(() => {
      getInventory().then(setInventory)
    })
    
    return () => {
      unsubSalesLogs()
      unsubInventory()
    }
  }, [])

  // Calculate metrics
  const totalRevenue = useMemo(() => {
    return salesReport.reduce((sum, r) => sum + r.revenue, 0)
  }, [salesReport])

  const totalSalesVolume = useMemo(() => {
    return salesReport.reduce((sum, r) => sum + r.total_sold, 0)
  }, [salesReport])

  const topSellingMenu = useMemo(() => {
    if (salesReport.length === 0) return null
    return salesReport.reduce((top, curr) => 
      curr.total_sold > top.total_sold ? curr : top
    )
  }, [salesReport])

  // Estimated COGS (next phase - placeholder calculation based on inventory cost)
  const estimatedCOGS = useMemo(() => {
    // For now, calculate based on inventory unit costs
    const totalInventoryCost = inventory.reduce((sum, item) => {
      const cost = item.unit_cost || 0
      const stock = item.stock || item.current_stock || 0
      return sum + (cost * stock)
    }, 0)
    // Estimate COGS as a percentage of total revenue
    return totalRevenue > 0 ? Math.round(totalRevenue * 0.35) : 0
  }, [inventory, totalRevenue])

  // BEP Calculation (Break-Even Point)
  // BEP Units = Fixed Costs / (Average Price - Average Variable Cost per Unit)
  const bepAnalysis = useMemo(() => {
    const fixed = parseFloat(fixedCost) || 0
    if (fixed === 0 || totalSalesVolume === 0) return null
    
    const avgPricePerUnit = totalRevenue / totalSalesVolume
    const avgCostPerUnit = estimatedCOGS / totalSalesVolume
    const contributionMargin = avgPricePerUnit - avgCostPerUnit
    
    if (contributionMargin <= 0) return null
    
    const bepUnits = Math.ceil(fixed / contributionMargin)
    const bepRevenue = bepUnits * avgPricePerUnit
    
    return {
      units: bepUnits,
      revenue: bepRevenue,
      contributionMargin,
      avgPricePerUnit,
      avgCostPerUnit
    }
  }, [fixedCost, totalRevenue, totalSalesVolume, estimatedCOGS])

  // Format price in IDR
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  // Prepare chart data
  const menuSalesData = useMemo(() => {
    return salesReport
      .map(r => ({ name: r.menu_name, sales: r.total_sold, revenue: r.revenue }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10) // Top 10
  }, [salesReport])

  // Inventory by category
  const inventoryByCategory = useMemo(() => {
    const categories = ["beans", "milk", "syrup", "cups", "food"]
    return categories.map((cat) => {
      const items = inventory.filter((i) => i.category === cat)
      const totalStock = items.reduce((sum, i) => sum + (i.stock || i.current_stock || 0), 0)
      return { name: cat.charAt(0).toUpperCase() + cat.slice(1), value: totalStock, count: items.length }
    })
  }, [inventory])

  const COLORS = ["#1a1a1a", "#404040", "#666666", "#999999", "#cccccc"]

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
        <h1 className="text-3xl font-light tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Revenue, sales, and business insights</p>
      </header>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Revenue */}
        <Card className="rounded-sm border-none bg-primary text-primary-foreground shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium opacity-80 flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5" />
              TOTAL REVENUE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(financials?.revenue || totalRevenue)}</p>
            <div className="flex items-center gap-1 mt-1 opacity-80">
              <TrendingUp className="w-3 h-3 text-[var(--status-healthy)]" />
              <p className="text-[10px] font-medium">+12% from last month</p>
            </div>
          </CardContent>
        </Card>
        
        {/* Gross Profit */}
        <Card className="rounded-sm shadow-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              GROSS PROFIT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(financials?.grossProfit || totalRevenue - estimatedCOGS)}</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
              Margin: {financials?.revenue ? Math.round((financials.grossProfit / financials.revenue) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
        
        {/* Net Profit */}
        <Card className="rounded-sm shadow-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5" />
              NET PROFIT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatPrice(financials?.netProfit || 0)}</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
              After OPEX & Waste
            </p>
          </CardContent>
        </Card>
        
        {/* Average Order Value */}
        <Card className="rounded-sm shadow-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="w-3.5 h-3.5" />
              AVG ORDER VALUE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(financials?.aov || 0)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {financials?.totalTransactions || 0} transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Target & KPI Status Integration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 rounded-sm shadow-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Monthly Revenue Target
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Status as of {format(new Date(), "MMMM yyyy")}</p>
            </div>
            {target && financials && (
              <Badge className={cn("rounded-sm px-3", 
                (financials.revenue / target.revenue_target) < 0.8 ? "bg-red-500 hover:bg-red-500" :
                (financials.revenue / target.revenue_target) < 1.0 ? "bg-amber-500 hover:bg-amber-500" :
                (financials.revenue / target.revenue_target) < 1.1 ? "bg-emerald-500 hover:bg-emerald-500" :
                "bg-purple-500 hover:bg-purple-500"
              )}>
                {(() => {
                  const progress = financials.revenue / target.revenue_target
                  if (progress < 0.8) return "UNDERPERFORM"
                  if (progress < 1.0) return "ON TRACK"
                  if (progress < 1.1) return "ACHIEVED"
                  return "OUTSTANDING"
                })()}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {target && financials ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm items-end mb-1">
                    <span className="font-medium">Revenue Progress</span>
                    <span className="text-muted-foreground">
                      <span className="text-foreground font-bold">{formatPrice(financials.revenue)}</span> / {formatPrice(target.revenue_target)}
                    </span>
                  </div>
                  <Progress value={Math.min(100, (financials.revenue / target.revenue_target) * 100)} className="h-2 rounded-full" />
                </div>

                <div className="grid grid-cols-2 gap-8 py-2">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Sales Volume</p>
                    <p className="text-xl font-bold">{totalSalesVolume} / {target.sales_target} units</p>
                    <Progress value={Math.min(100, (totalSalesVolume / target.sales_target) * 100)} className="h-1 rounded-full opacity-60" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Upselling Index (AOV)</p>
                    <p className="text-xl font-bold">{formatPrice(financials.aov)} / {formatPrice(target.aov_target)}</p>
                    <Progress value={Math.min(100, (financials.aov / target.aov_target) * 100)} className="h-1 rounded-full opacity-60" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center border border-dashed rounded-sm">
                <p className="text-sm text-muted-foreground">Initializing monthly targets...</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-sm shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Peak Service Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Object.entries(financials?.salesPerHour || {}).map(([hour, count]) => ({ hour, count }))}>
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Bar dataKey="count" fill="#1a1a1a" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-center text-muted-foreground mt-4">
              Real-time shift efficiency based on transaction logs
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Menu Sales Chart */}
        <Card className="rounded-sm">
          <CardHeader>
            <CardTitle>Sales by Menu</CardTitle>
          </CardHeader>
          <CardContent>
            {menuSalesData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={menuSalesData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="#666" />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tick={{ fontSize: 11 }} 
                      stroke="#666"
                      width={100}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "#fff", 
                        border: "1px solid #e0e0e0",
                        borderRadius: "4px"
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === "sales") return [value, "Quantity"]
                        return [formatPrice(value), "Revenue"]
                      }}
                    />
                    <Bar dataKey="sales" fill="#1a1a1a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">No sales data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventory Distribution */}
        <Card className="rounded-sm">
          <CardHeader>
            <CardTitle>Inventory by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie
                    data={inventoryByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {inventoryByCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {inventoryByCategory.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-sm shrink-0" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm flex-1">{item.name}</span>
                    <span className="text-sm text-muted-foreground">{item.count} items</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BEP Calculator */}
      <Card className="rounded-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Break-Even Point (BEP) Calculator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Input Section */}
            <div>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="fixedCost" className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Monthly Fixed Costs (IDR)
                  </Label>
                  <Input
                    id="fixedCost"
                    type="number"
                    placeholder="e.g. 5000000"
                    value={fixedCost}
                    onChange={(e) => setFixedCost(e.target.value)}
                    className="rounded-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Include rent, utilities, salaries, etc.
                  </p>
                </div>
                
                {/* Auto-calculated values */}
                <div className="bg-muted/50 p-4 rounded-sm space-y-2">
                  <p className="text-sm font-medium mb-3">Based on your sales data:</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg. Price per Unit</span>
                    <span className="font-mono">
                      {totalSalesVolume > 0 ? formatPrice(totalRevenue / totalSalesVolume) : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg. Cost per Unit (Est.)</span>
                    <span className="font-mono">
                      {totalSalesVolume > 0 ? formatPrice(estimatedCOGS / totalSalesVolume) : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Contribution Margin</span>
                    <span className="font-mono">
                      {bepAnalysis ? formatPrice(bepAnalysis.contributionMargin) : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Results Section */}
            <div>
              {bepAnalysis ? (
                <div className="space-y-4">
                  <div className="bg-foreground text-background p-6 rounded-sm text-center">
                    <p className="text-sm opacity-80 mb-2">Break-Even Point</p>
                    <p className="text-4xl font-bold">{bepAnalysis.units}</p>
                    <p className="text-sm opacity-80">units to sell</p>
                  </div>
                  
                  <div className="bg-muted/50 p-4 rounded-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">BEP Revenue Target</span>
                      <span className="text-lg font-semibold">{formatPrice(bepAnalysis.revenue)}</span>
                    </div>
                  </div>
                  
                  <div className="bg-muted/50 p-4 rounded-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Sales vs BEP</span>
                      <span className={`text-lg font-semibold ${totalSalesVolume >= bepAnalysis.units ? "text-[var(--status-healthy)]" : "text-[var(--status-warning)]"}`}>
                        {totalSalesVolume} / {bepAnalysis.units}
                      </span>
                    </div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${totalSalesVolume >= bepAnalysis.units ? "bg-[var(--status-healthy)]" : "bg-[var(--status-warning)]"}`}
                        style={{ width: `${Math.min(100, (totalSalesVolume / bepAnalysis.units) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {totalSalesVolume >= bepAnalysis.units 
                        ? "You have reached break-even!" 
                        : `${bepAnalysis.units - totalSalesVolume} more units needed to break even`
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-8">
                  <Calculator className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Enter your fixed costs to calculate BEP</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    BEP helps you understand how many items you need to sell to cover your costs
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
