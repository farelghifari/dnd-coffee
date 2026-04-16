"use client"

import { useState, useEffect } from "react"
import { 
  getInventory,
  getOnShiftEmployees,
  getOverallStockHealth,
  getLowStockItems,
  getOperationalCapacity,
  type InventoryItem,
  type Employee
} from "@/lib/api/supabase-service"
import { Package, AlertTriangle, Clock, Users } from "lucide-react"
import { cn } from "@/lib/utils"

export function StockWidgets() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [onShiftEmployees, setOnShiftEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const [inventoryData, onShiftData] = await Promise.all([
        getInventory(),
        getOnShiftEmployees()
      ])
      setInventory(inventoryData)
      setOnShiftEmployees(onShiftData)
      setIsLoading(false)
    }
    
    fetchData()
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const stockHealth = getOverallStockHealth(inventory)
  const lowStockItems = getLowStockItems(inventory)
  const operationalCapacity = getOperationalCapacity(inventory)

  const getHealthColor = (percentage: number) => {
    if (percentage >= 80) return "text-[var(--status-healthy)]"
    if (percentage >= 50) return "text-[var(--status-warning)]"
    return "text-[var(--status-critical)]"
  }

  const getCapacityColor = (days: number) => {
    if (days >= 5) return "text-[var(--status-healthy)]"
    if (days >= 2) return "text-[var(--status-warning)]"
    return "text-[var(--status-critical)]"
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-sm p-4 border border-border animate-pulse">
            <div className="h-16 bg-muted rounded"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* On Shift */}
      <div className="bg-card rounded-sm p-4 border border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center">
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-xs text-muted-foreground">On Shift</h3>
            <p className="text-xl font-light">{onShiftEmployees.length}</p>
          </div>
        </div>
        {onShiftEmployees.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {onShiftEmployees.map((emp) => (
              <span key={emp.id} className="text-xs px-2 py-1 bg-muted rounded-sm">
                {emp.nickname}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stock Health */}
      <div className="bg-card rounded-sm p-4 border border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center">
            <Package className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-xs text-muted-foreground">Stock Health</h3>
            <p className={cn("text-xl font-light", getHealthColor(stockHealth))}>
              {stockHealth}%
            </p>
          </div>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              stockHealth >= 80 && "bg-[var(--status-healthy)]",
              stockHealth >= 50 && stockHealth < 80 && "bg-[var(--status-warning)]",
              stockHealth < 50 && "bg-[var(--status-critical)]"
            )}
            style={{ width: `${stockHealth}%` }}
          />
        </div>
      </div>

      {/* Operational Capacity */}
      <div className="bg-card rounded-sm p-4 border border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center">
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-xs text-muted-foreground">Operational Capacity</h3>
            <p className={cn("text-xl font-light", getCapacityColor(operationalCapacity))}>
              {operationalCapacity} <span className="text-sm">days</span>
            </p>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      <div className="bg-card rounded-sm p-4 border border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-sm bg-[var(--status-warning)]/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-[var(--status-warning)]" />
          </div>
          <h3 className="text-xs text-muted-foreground">Low Stock Alert</h3>
        </div>

        {lowStockItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">All stock levels healthy</p>
        ) : (
          <ul className="space-y-2 max-h-32 overflow-y-auto">
            {lowStockItems.slice(0, 4).map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{item.name}</span>
                <span
                  className={cn(
                    "text-xs font-mono ml-2",
                    item.daysRemaining <= 1 && "text-[var(--status-critical)]",
                    item.daysRemaining > 1 && item.daysRemaining <= 3 && "text-[var(--status-warning)]",
                    item.daysRemaining > 3 && "text-[var(--status-healthy)]"
                  )}
                >
                  {item.daysRemaining}d
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
