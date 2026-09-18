"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  getInventory,
  getPurchaseRecommendations,
  getDaysRemaining,
  getStockHealth,
  type InventoryItem
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingUp, 
  Receipt, 
  AlertTriangle, 
  Package,
  Calendar
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts"

export default function ForecastingPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const data = await getInventory()
      setInventory(data)
      setIsLoading(false)
    }
    fetchData()
  }, [])

  const purchaseRecommendations = getPurchaseRecommendations(inventory)
  
  // Generate forecast data for each item (simulated projection)
  const generateForecast = (item: InventoryItem) => {
    const data = []
    let currentStock = item.current_stock ?? 0
    
    for (let i = 0; i <= 14; i++) {
      data.push({
        day: i,
        label: i === 0 ? "Today" : `Day ${i}`,
        stock: Math.max(0, currentStock),
        minStock: item.min_stock ?? 0,
      })
      currentStock -= (item.daily_usage ?? 0)
    }
    
    return data
  }

  // Overall inventory health forecast
  const overallForecast = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const healthyCount = inventory.filter((item) => {
        const projectedStock = (item.current_stock ?? 0) - ((item.daily_usage ?? 0) * i)
        return projectedStock > (item.min_stock ?? 0)
      }).length
      
      return {
        day: i === 0 ? "Today" : `Day ${i}`,
        healthy: inventory.length > 0 ? Math.round((healthyCount / inventory.length) * 100) : 0,
      }
    })
  }, [inventory])

  const criticalCount = useMemo(() => {
    return inventory.filter((i) => getStockHealth(i) === "critical").length
  }, [inventory])

  const minDaysRemaining = useMemo(() => {
    if (inventory.length === 0) return 0
    return Math.min(...inventory.map(getDaysRemaining))
  }, [inventory])

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
        <h1 className="text-3xl font-light tracking-tight">Forecasting</h1>
        <p className="text-muted-foreground">Demand predictions and purchase recommendations</p>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="rounded-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Operational Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light">
              {minDaysRemaining.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">until first stockout</p>
          </CardContent>
        </Card>

        <Card className="rounded-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Purchase Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light">{purchaseRecommendations.length}</div>
            <p className="text-xs text-muted-foreground">items need restocking</p>
          </CardContent>
        </Card>

        <Card className="rounded-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Critical Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light text-[var(--status-critical)]">
              {criticalCount}
            </div>
            <p className="text-xs text-muted-foreground">require immediate action</p>
          </CardContent>
        </Card>
      </div>

      <div className="max-h-[calc(100vh-350px)] overflow-y-auto space-y-8 pb-6">
        {/* Overall Health Forecast */}
        <Card className="rounded-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              14-Day Inventory Health Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overallForecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#666" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#666" domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "#fff", 
                      border: "1px solid #e0e0e0",
                      borderRadius: "4px"
                    }}
                    formatter={(value: number) => [`${value}%`, "Health"]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="healthy" 
                    stroke="#1a1a1a" 
                    fill="#e0e0e0"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Purchase Recommendations */}
        <Card className="rounded-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Purchase Recommendations
              </CardTitle>
              <Button className="rounded-sm" size="sm">
                Generate Purchase Order
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {purchaseRecommendations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                All stock levels are healthy. No purchases recommended.
              </p>
            ) : (
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {purchaseRecommendations.map(({ item, recommendedQty, coverageDays }) => {
                  const daysRemaining = getDaysRemaining(item)
                  const health = getStockHealth(item)
                  
                  return (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between p-4 rounded-sm border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-sm flex items-center justify-center",
                          health === "critical" && "bg-[var(--status-critical)]/10",
                          health === "warning" && "bg-[var(--status-warning)]/10",
                          health === "healthy" && "bg-[var(--status-healthy)]/10"
                        )}>
                          <Package className={cn(
                            "w-5 h-5",
                            health === "critical" && "text-[var(--status-critical)]",
                            health === "warning" && "text-[var(--status-warning)]",
                            health === "healthy" && "text-[var(--status-healthy)]"
                          )} />
                        </div>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Current: {item.current_stock ?? 0} {item.unit} ({daysRemaining.toFixed(1)} days)
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="font-medium">
                            Buy {recommendedQty} {item.unit}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {coverageDays} days coverage
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "rounded-sm",
                            health === "critical" && "border-[var(--status-critical)] text-[var(--status-critical)]",
                            health === "warning" && "border-[var(--status-warning)] text-[var(--status-warning)]"
                          )}
                        >
                          {health === "critical" ? "Urgent" : "Soon"}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Individual Item Forecasts */}
        <h2 className="text-xl font-medium">Stock Level Projections</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {inventory.slice(0, 6).map((item) => {
            const forecastData = generateForecast(item)
            const health = getStockHealth(item)
            
            return (
              <Card key={item.id} className="rounded-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "rounded-sm capitalize",
                        health === "critical" && "border-[var(--status-critical)] text-[var(--status-critical)]",
                        health === "warning" && "border-[var(--status-warning)] text-[var(--status-warning)]",
                        health === "healthy" && "border-[var(--status-healthy)] text-[var(--status-healthy)]"
                      )}
                    >
                      {health}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.current_stock ?? 0} {item.unit} remaining | {item.daily_usage ?? 0} {item.unit}/day usage
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={forecastData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#666" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#666" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "#fff", 
                            border: "1px solid #e0e0e0",
                            borderRadius: "4px",
                            fontSize: "12px"
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="stock" 
                          stroke="#1a1a1a" 
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="minStock" 
                          stroke="#999" 
                          strokeDasharray="5 5"
                          strokeWidth={1}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
