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
import { Package, AlertTriangle, Clock, Users, ShoppingCart, Info } from "lucide-react"
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
    <div className="flex flex-col h-full space-y-2 overflow-hidden">
      {/* On Shift - Compact */}
      <div className="bg-card rounded-sm p-3 border border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-3 h-3 text-muted-foreground" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">On Shift</h3>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {onShiftEmployees.length > 0 ? (
            onShiftEmployees.map((emp) => (
              <span key={emp.id} className="text-[9px] px-1.5 py-0.5 bg-muted rounded-full font-medium">
                {emp.nickname}
              </span>
            ))
          ) : (
            <span className="text-[9px] text-muted-foreground italic">None</span>
          )}
        </div>
      </div>

      {/* Stock Health & Capacity - Side by Side */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card rounded-sm p-3 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-3 h-3 text-muted-foreground" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Health</h3>
          </div>
          <p className={cn("text-lg font-bold", getHealthColor(stockHealth))}>
            {stockHealth}%
          </p>
        </div>

        <div className="bg-card rounded-sm p-3 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Capacity</h3>
          </div>
          <p className={cn("text-lg font-bold", getCapacityColor(operationalCapacity))}>
            {operationalCapacity} <span className="text-[10px] font-normal opacity-50">d</span>
          </p>
        </div>
      </div>

      {/* Stock Alerts (Shopping List) - Expanded to fill remaining space */}
      <div className="bg-card rounded-sm p-3 border border-border flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary">Shopping List</h3>
          </div>
          <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
            {lowStockItems.length}
          </span>
        </div>

        {lowStockItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-sm">
             <Package className="w-6 h-6 text-muted/30 mb-2" />
             <p className="text-[9px] text-muted-foreground uppercase font-bold">Stock Healthy</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
            {/* 1. OUT OF STOCK SECTION */}
            {lowStockItems.filter(i => (i.stock || i.current_stock || 0) <= 0).length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[8px] font-bold text-[var(--status-critical)] uppercase tracking-tighter flex items-center gap-1 sticky top-0 bg-card py-1 z-10">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Out of Stock
                </p>
                <div className="space-y-1">
                  {lowStockItems.filter(i => (i.stock || i.current_stock || 0) <= 0).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-1.5 bg-[var(--status-critical)]/5 border border-[var(--status-critical)]/10 rounded-sm">
                      <span className="text-[11px] font-medium truncate pr-2">{item.name}</span>
                      <span className="text-[8px] font-bold text-[var(--status-critical)] bg-[var(--status-critical)]/10 px-1 py-0.5 rounded-sm flex-shrink-0">OUT</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. LOW STOCK SECTION */}
            {lowStockItems.filter(i => (i.stock || i.current_stock || 0) > 0).length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[8px] font-bold text-[var(--status-warning)] uppercase tracking-tighter flex items-center gap-1 sticky top-0 bg-card py-1 z-10">
                  <Info className="w-2.5 h-2.5" />
                  Low Stock
                </p>
                <div className="space-y-1">
                  {lowStockItems.filter(i => (i.stock || i.current_stock || 0) > 0).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-1.5 bg-muted/20 border border-border/50 rounded-sm">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-medium truncate">{item.name}</span>
                        <span className="text-[8px] text-muted-foreground">
                          {item.current_stock || item.stock} {item.unit}
                        </span>
                      </div>
                      <span className={cn(
                        "text-[9px] font-mono font-bold flex-shrink-0 ml-2",
                        item.daysRemaining <= 1 ? "text-[var(--status-critical)]" : "text-[var(--status-warning)]"
                      )}>
                        {item.daysRemaining}d
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
