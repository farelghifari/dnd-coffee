"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  getMenuItems,
  getSalesReport,
  getInventory,
  getFinancialSummary,
  getMonthlyTarget,
  getAllMenuRecipes,
  subscribeToSalesLogs,
  subscribeToInventoryItems,
  type SalesReport,
  type InventoryItem,
  type FinancialSummary,
  type MonthlyTarget,
  type MenuItem
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  BarChart3, 
  PieChart as PieIcon,
  Calculator,
  ArrowUpRight,
  Target,
  Clock,
  AlertCircle,
  ShieldCheck,
  Wallet
} from "lucide-react"
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
  Cell,
  LineChart,
  Line
} from 'recharts'
import { format, startOfMonth, endOfMonth } from "date-fns"
import { cn } from "@/lib/utils"

export default function AnalyticsPage() {
  // Data from Supabase
  const [salesReport, setSalesReport] = useState<SalesReport[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [financials, setFinancials] = useState<FinancialSummary | null>(null)
  const [target, setTarget] = useState<MonthlyTarget | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const currentMonth = format(new Date(), "yyyy-MM")

  const fetchData = async () => {
    setIsLoading(true)
    const [salesData, inventoryData, financialData, targetData, menuData] = await Promise.all([
      getSalesReport(currentMonth),
      getInventory(),
      getFinancialSummary(currentMonth),
      getMonthlyTarget(currentMonth),
      getMenuItems()
    ])
    setSalesReport(salesData)
    setInventory(inventoryData)
    setFinancials(financialData)
    setTarget(targetData)
    setMenuItems(menuData)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchData()
    
    // Subscribe to sales_logs changes
    const unsubSalesLogs = subscribeToSalesLogs(() => {
      getSalesReport(currentMonth).then(setSalesReport)
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

  // Basic stats
  const totalRevenue = useMemo(() => 
    salesReport.reduce((sum, item) => sum + item.revenue, 0)
  , [salesReport])

  const totalSalesVolume = useMemo(() => 
    salesReport.reduce((sum, item) => sum + item.total_sold, 0)
  , [salesReport])

  const topSellingMenu = useMemo(() => {
    if (salesReport.length === 0) return null
    return salesReport.reduce((top, curr) => 
      curr.total_sold > top.total_sold ? curr : top
    )
  }, [salesReport])

  // Actual COGS calculation based on recipes and inventory costs
  const actualCOGS = useMemo(() => {
    let totalCost = 0
    
    salesReport.forEach(sale => {
      // Find the menu item with its recipe attached
      const menuItem = menuItems.find(m => m.id === sale.menu_id)
      
      let menuUnitCost = 0
      
      if (menuItem?.recipe?.ingredients) {
        menuItem.recipe.ingredients.forEach(ing => {
          const invItem = inventory.find(i => i.id === ing.inventory_item_id)
          if (invItem) {
            menuUnitCost += (ing.quantity || 0) * (invItem.unit_cost || 0)
          }
        })
        
        // Add packaging cost if available
        menuUnitCost += (menuItem.packaging_cost || 0)
      }
      
      // If no recipe found or cost is 0, fallback to 35% estimate as a safety measure
      if (menuUnitCost === 0 && sale.revenue > 0) {
        menuUnitCost = (sale.revenue / sale.total_sold) * 0.35
      }
      
      totalCost += menuUnitCost * sale.total_sold
    })
    
    return Math.round(totalCost)
  }, [salesReport, menuItems, inventory])

  // BEP Calculation (Break-Even Point)
  const [fixedCost, setFixedCost] = useState("0")
  const bepAnalysis = useMemo(() => {
    const fixed = parseFloat(fixedCost) || 0
    if (fixed === 0 || totalSalesVolume === 0) return null
    
    const avgPricePerUnit = totalRevenue / totalSalesVolume
    const avgCostPerUnit = actualCOGS / totalSalesVolume
    const contributionMargin = avgPricePerUnit - avgCostPerUnit
    
    if (contributionMargin <= 0) return null
    
    const units = Math.ceil(fixed / contributionMargin)
    const revenue = units * avgPricePerUnit
    
    return { units, revenue, contributionMargin }
  }, [fixedCost, totalRevenue, totalSalesVolume, actualCOGS])

  // Inventory stats by category
  const inventoryByCategory = useMemo(() => {
    const categories: Record<string, number> = {}
    inventory.forEach(item => {
      categories[item.category] = (categories[item.category] || 0) + 1
    })
    return Object.entries(categories).map(([name, count]) => ({ name, count }))
  }, [inventory])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const revenueDistribution = useMemo(() => {
    return salesReport
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(s => ({ name: s.menu_name, value: s.revenue }))
  }, [salesReport])

  const COLORS = ["#1a1a1a", "#404040", "#666666", "#999999", "#cccccc"]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-light tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Revenue, sales, and business insights</p>
      </header>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-sm border-none bg-primary text-primary-foreground shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium opacity-80 flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5" />
              TOTAL REVENUE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(totalRevenue)}</p>
            <div className="flex items-center gap-1 mt-1 opacity-80">
              <TrendingUp className="w-3 h-3 text-green-400" />
              <p className="text-[10px] font-medium">+12% from last month</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-sm shadow-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              GROSS PROFIT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatPrice(totalRevenue - actualCOGS)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Margin: {totalRevenue > 0 ? Math.round(((totalRevenue - actualCOGS) / totalRevenue) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-sm shadow-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5" />
              NET PROFIT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              (totalRevenue - actualCOGS - (financials?.opex || 0) - (financials?.waste || 0) - (financials?.payroll || 0)) >= 0 
                ? "text-green-600" 
                : "text-destructive"
            )}>
              {formatPrice(totalRevenue - actualCOGS - (financials?.opex || 0) - (financials?.waste || 0) - (financials?.payroll || 0))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              After All Expenses
            </p>
          </CardContent>
        </Card>
        
        <Card className="rounded-sm shadow-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="w-3.5 h-3.5" />
              AVG ORDER VALUE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatPrice(totalSalesVolume > 0 ? totalRevenue / totalSalesVolume : 0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Across {totalSalesVolume} items
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Menu Chart */}
        <Card className="rounded-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Sales Volume by Menu</CardTitle>
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
              <div className="flex items-center justify-center h-full text-muted-foreground">No sales data</div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Distribution Chart - FIXED UI */}
        <Card className="rounded-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieIcon className="w-4 h-4" />
              Revenue Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] flex flex-col sm:flex-row items-center gap-4">
            <div className="h-[220px] w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {revenueDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatPrice(value)}
                    contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 space-y-3">
              {revenueDistribution.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs group">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 shrink-0 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1">{item.name}</span>
                  </div>
                  <span className="text-foreground font-mono font-bold ml-2">{formatPrice(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Breakdown - Moved down */}
        <Card className="rounded-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Financial Health Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Total Revenue</span>
                <span className="text-sm font-semibold">{formatPrice(totalRevenue)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Actual COGS (Recipes)</span>
                <span className="text-sm font-semibold text-destructive">-{formatPrice(actualCOGS)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50 bg-muted/20 px-2 rounded-sm">
                <span className="text-sm font-bold">Gross Profit</span>
                <span className="text-sm font-bold text-green-600">{formatPrice(totalRevenue - actualCOGS)}</span>
              </div>
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Operational Costs (OPEX)</span>
                  <span className="text-sm font-semibold text-destructive">-{formatPrice(financials?.opex || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Staff Payroll</span>
                  <span className="text-sm font-semibold text-destructive">-{formatPrice(financials?.payroll || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Inventory Waste</span>
                  <span className="text-sm font-semibold text-destructive">-{formatPrice(financials?.waste || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-3 mt-1 bg-primary/5 px-2 rounded-sm border border-primary/10">
                  <span className="font-bold">Net Profit</span>
                  <span className={cn(
                    "text-xl font-bold",
                    (totalRevenue - actualCOGS - (financials?.opex || 0) - (financials?.waste || 0) - (financials?.payroll || 0)) >= 0 
                      ? "text-green-600" 
                      : "text-destructive"
                  )}>
                    {formatPrice(totalRevenue - actualCOGS - (financials?.opex || 0) - (financials?.waste || 0) - (financials?.payroll || 0))}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* BEP Calculator */}
        <Card className="rounded-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Calculator className="w-4 h-4" />
              Break-Even Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="fixedCost" className="text-xs uppercase font-bold text-muted-foreground">Monthly Fixed Costs (IDR)</Label>
                  <Input
                    id="fixedCost"
                    type="number"
                    value={fixedCost}
                    onChange={(e) => setFixedCost(e.target.value)}
                    className="h-10 rounded-sm"
                  />
                  <p className="text-[10px] text-muted-foreground italic">Include rent, total salaries, and regular bills.</p>
                </div>
                <div className="bg-muted/30 p-3 rounded-sm space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Avg. Revenue / Item</span>
                    <span className="font-mono">{formatPrice(totalSalesVolume > 0 ? totalRevenue / totalSalesVolume : 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg. Cost / Item</span>
                    <span className="font-mono">{formatPrice(totalSalesVolume > 0 ? actualCOGS / totalSalesVolume : 0)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                {bepAnalysis ? (
                  <div className="text-center space-y-3">
                    <div className="bg-primary text-primary-foreground p-4 rounded-sm">
                      <p className="text-[10px] uppercase opacity-70">Target Penjualan BEP</p>
                      <p className="text-3xl font-bold">{bepAnalysis.units}</p>
                      <p className="text-[10px] uppercase opacity-70">Porsi / Menu</p>
                    </div>
                    <p className={`text-xs font-medium ${totalSalesVolume >= bepAnalysis.units ? "text-green-600" : "text-amber-600"}`}>
                      {totalSalesVolume >= bepAnalysis.units 
                        ? "✓ Target BEP Tercapai!" 
                        : `Kurang ${bepAnalysis.units - totalSalesVolume} porsi lagi`}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs">Masukkan biaya tetap untuk hitung BEP</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
