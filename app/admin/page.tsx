"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  getInventory, 
  getActiveEmployees, 
  getStockLogs, 
  getMenuItems,
  getTodayAttendance,
  getPendingOvertimeRequests,
  getOnShiftEmployees,
  getOverallStockHealth,
  getLowStockItems,
  getOperationalCapacity,
  getPurchaseRecommendations,
  getAttendanceStats,
  getDisplayStock,
  getDisplayUnit,
  type InventoryItem,
  type Employee,
  type StockLog,
  type AttendanceLog,
  type MenuItem,
  type OvertimeRequest
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Package, Users, Coffee, AlertTriangle, TrendingUp, Clock, Bell, Receipt, UserCheck, ClockIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export default function AdminDashboard() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stockLogs, setStockLogs] = useState<StockLog[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [todayAttendance, setTodayAttendance] = useState<AttendanceLog[]>([])
  const [pendingOvertimeRequests, setPendingOvertimeRequests] = useState<OvertimeRequest[]>([])
  const [onShiftEmployees, setOnShiftEmployees] = useState<Employee[]>([])
  const [latenessStats, setLatenessStats] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async (silent = false) => {
      if (!silent) setIsLoading(true)
      const [
        inventoryData,
        employeesData,
        stockLogsData,
        menuData,
        attendanceData,
        overtimeData,
        onShiftData,
        attendanceStatsData
      ] = await Promise.all([
        getInventory(),
        getActiveEmployees(),
        getStockLogs(),
        getMenuItems(),
        getTodayAttendance(),
        getPendingOvertimeRequests(),
        getOnShiftEmployees(),
        getAttendanceStats()
      ])
      
      setInventory(inventoryData)
      setEmployees(employeesData)
      setStockLogs(stockLogsData)
      setMenuItems(menuData)
      setTodayAttendance(attendanceData)
      setPendingOvertimeRequests(overtimeData)
      setOnShiftEmployees(onShiftData)
      setLatenessStats(attendanceStatsData)
      if (!silent) setIsLoading(false)
    }
    
    fetchData()
    
    // Refresh data every 10 seconds for real-time sync
    const interval = setInterval(() => fetchData(true), 10000)
    return () => clearInterval(interval)
  }, [])

  const stockHealth = getOverallStockHealth(inventory)
  const lowStockItems = getLowStockItems(inventory)
  const operationalCapacity = getOperationalCapacity(inventory)
  const activeEmployees = employees.length
  const purchaseRecommendations = getPurchaseRecommendations(inventory)
  const recentLogs = [...stockLogs].slice(0, 5)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to DONOTDISTURB management system</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingOvertimeRequests.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-sm border-yellow-500/50 text-yellow-600 hover:bg-yellow-50"
              onClick={() => window.location.href = "/admin/overtime"}
            >
              <ClockIcon className="w-4 h-4 mr-2" />
              {pendingOvertimeRequests.length} Overtime
            </Button>
          )}
          <Button variant="outline" size="sm" className="rounded-sm">
            <Bell className="w-4 h-4 mr-2" />
            {lowStockItems.length} Alerts
          </Button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Products
            </CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{inventory.length}</div>
            <p className="text-xs text-muted-foreground">items in inventory</p>
          </CardContent>
        </Card>

        <Card className="rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Staff On Shift
            </CardTitle>
            <UserCheck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{onShiftEmployees.length}</div>
            <p className="text-xs text-muted-foreground">of {activeEmployees} active</p>
          </CardContent>
        </Card>

        <Card className="rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Menu Items
            </CardTitle>
            <Coffee className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{menuItems.length}</div>
            <p className="text-xs text-muted-foreground">active products</p>
          </CardContent>
        </Card>

        <Card className="rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stock Health
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-light",
              stockHealth >= 80 && "text-[var(--status-healthy)]",
              stockHealth >= 50 && stockHealth < 80 && "text-[var(--status-warning)]",
              stockHealth < 50 && "text-[var(--status-critical)]"
            )}>
              {stockHealth}%
            </div>
            <p className="text-xs text-muted-foreground">overall health</p>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Alerts */}
        <Card className="rounded-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[var(--status-warning)]" />
                <CardTitle>Low Stock Alerts</CardTitle>
              </div>
              <Link href="/admin/inventory">
                <Button variant="ghost" size="sm" className="text-xs">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <p className="text-muted-foreground text-sm">All stock levels are healthy</p>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {lowStockItems.slice(0, 4).map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 rounded-sm bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getDisplayStock(item.current_stock || 0, item)} {getDisplayUnit(item)} remaining
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-mono px-2 py-1 rounded-sm",
                        item.daysRemaining <= 1 && "bg-[var(--status-critical)]/10 text-[var(--status-critical)]",
                        item.daysRemaining > 1 && item.daysRemaining <= 3 && "bg-[var(--status-warning)]/10 text-[var(--status-warning)]",
                        item.daysRemaining > 3 && "bg-[var(--status-healthy)]/10 text-[var(--status-healthy)]"
                      )}
                    >
                      {item.daysRemaining}d
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Purchase Recommendations */}
        <Card className="rounded-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-foreground" />
                <CardTitle>Purchase Recommendations</CardTitle>
              </div>
              <Link href="/admin/forecasting">
                <Button variant="ghost" size="sm" className="text-xs">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {purchaseRecommendations.length === 0 ? (
              <p className="text-muted-foreground text-sm">No urgent purchases needed</p>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {purchaseRecommendations.slice(0, 4).map(({ item, recommendedQty, coverageDays }) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 rounded-sm bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Buy {getDisplayStock(recommendedQty, item)} {getDisplayUnit(item)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {coverageDays}d coverage
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operational Status */}
        <Card className="rounded-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-foreground" />
              <CardTitle>Operational Status</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Operational Capacity</span>
                  <span className={cn(
                    "font-mono text-sm",
                    operationalCapacity >= 5 && "text-[var(--status-healthy)]",
                    operationalCapacity >= 2 && operationalCapacity < 5 && "text-[var(--status-warning)]",
                    operationalCapacity < 2 && "text-[var(--status-critical)]"
                  )}>
                    {operationalCapacity} days
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on lowest stock item
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                <div className="text-center">
                  <div className="text-xl font-light text-[var(--status-healthy)]">
                    {inventory.filter(i => ((i.current_stock ?? 0) / (i.daily_usage ?? 1)) > 5).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Healthy</p>
                </div>
                <div className="text-center">
                  <div className="text-xl font-light text-[var(--status-warning)]">
                    {inventory.filter(i => {
                      const days = (i.current_stock ?? 0) / (i.daily_usage ?? 1)
                      return days > 1 && days <= 5
                    }).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Warning</p>
                </div>
                <div className="text-center">
                  <div className="text-xl font-light text-[var(--status-critical)]">
                    {inventory.filter(i => (i.current_stock ?? 0) / (i.daily_usage ?? 1) <= 1).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Attendance */}
        <Card className="rounded-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-foreground" />
                <CardTitle>Today&apos;s Attendance</CardTitle>
              </div>
              <Link href="/admin/logs">
                <Button variant="ghost" size="sm" className="text-xs">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {todayAttendance.length === 0 ? (
                <p className="text-muted-foreground text-sm">No attendance records today</p>
              ) : (
                todayAttendance.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-center justify-between p-3 rounded-sm bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        log.type === "clock-in" ? "bg-[var(--status-healthy)]" : "bg-muted-foreground"
                      )} />
                      <div>
                        <p className="font-medium text-sm">{log.employee_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {(log.type || log.action || "clock-in").replace("-", " ")}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(log.timestamp || `${log.date}T${log.time}`).toLocaleTimeString("en-US", { 
                        hour: "2-digit", 
                        minute: "2-digit",
                        hour12: false
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Stock Activity */}
        <Card className="rounded-sm lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-foreground" />
                <CardTitle>Recent Stock Activity</CardTitle>
              </div>
              <Link href="/admin/logs">
                <Button variant="ghost" size="sm" className="text-xs">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {recentLogs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No stock activity recorded</p>
              ) : (
                recentLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-center justify-between p-3 rounded-sm bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-sm flex items-center justify-center text-xs font-medium",
                        log.type === "in" && "bg-[var(--status-healthy)]/10 text-[var(--status-healthy)]",
                        log.type === "out" && "bg-muted text-muted-foreground",
                        log.type === "waste" && "bg-[var(--status-critical)]/10 text-[var(--status-critical)]",
                        log.type === "opname" && "bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
                      )}>
                        {log.type === "in" ? "+" : log.type === "out" ? "-" : log.type === "waste" ? "W" : "O"}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{log.item_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(() => {
                            const item = inventory.find(i => i.id === log.item_id);
                            if (item) {
                              return `${getDisplayStock(log.amount, item)} ${getDisplayUnit(item)}`;
                            }
                            return `${log.amount} units`;
                          })()} by {log.employee_name}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Punctuality Monitor */}
        <Card className="rounded-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <CardTitle>Punctuality Monitor</CardTitle>
              </div>
              <Link href="/admin/attendance-report">
                <Button variant="ghost" size="sm" className="text-xs">Details</Button>
              </Link>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Late Counts This Month</p>
          </CardHeader>
          <CardContent>
            {latenessStats.length === 0 ? (
              <p className="text-muted-foreground text-sm">No lateness recorded this month</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {latenessStats.slice(0, 5).map((stat) => (
                  <div 
                    key={stat.name} 
                    className="flex items-center justify-between p-3 rounded-sm bg-muted/50 border-l-2 border-amber-500"
                  >
                    <div>
                      <p className="font-medium text-sm">{stat.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(stat.totalHours)}h worked so far
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-amber-600">
                        {stat.lateCount}x Late
                      </span>
                      <p className="text-[10px] text-muted-foreground">This period</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
