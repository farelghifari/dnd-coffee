"use client"

import { useState, useMemo } from "react"
import { useStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CalendarIcon, Search, Download, Filter, ArrowUpDown } from "lucide-react"
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from "date-fns"

type SortField = "timestamp" | "item" | "type" | "amount" | "employee"
type SortDirection = "asc" | "desc"

export default function TransactionsPage() {
  const { stockLogs, inventory, employees } = useStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [itemFilter, setItemFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 7),
    to: new Date()
  })
  const [sortField, setSortField] = useState<SortField>("timestamp")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId)
    return employee?.nickname || employee?.name || employeeId
  }

  const getItemName = (itemId: string) => {
    const item = inventory.find(i => i.id === itemId)
    return item?.name || itemId
  }

  const getItemUnit = (itemId: string) => {
    const item = inventory.find(i => i.id === itemId)
    return item?.unit || ""
  }

  const filteredAndSortedLogs = useMemo(() => {
    let filtered = stockLogs.filter(log => {
      // Search filter - use null safety to avoid crashes
      const itemName = (log.itemName || "").toLowerCase()
      const employeeName = (log.employeeName || "").toLowerCase()
      const logType = (log.type || "").toLowerCase()
      const matchesSearch = searchQuery === "" || 
        itemName.includes(searchQuery.toLowerCase()) ||
        employeeName.includes(searchQuery.toLowerCase()) ||
        logType.includes(searchQuery.toLowerCase())

      // Type filter
      const matchesType = typeFilter === "all" || log.type === typeFilter

      // Item filter
      const matchesItem = itemFilter === "all" || log.itemId === itemFilter

      // Date filter
      const logDate = new Date(log.timestamp)
      const matchesDate = (!dateRange.from || !dateRange.to) || 
        isWithinInterval(logDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to)
        })

      return matchesSearch && matchesType && matchesItem && matchesDate
    })

    // Sort - use null safety to avoid crashes
    filtered.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case "timestamp":
          comparison = new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
          break
        case "item":
          comparison = (a.itemName || "").localeCompare(b.itemName || "")
          break
        case "type":
          comparison = (a.type || "").localeCompare(b.type || "")
          break
        case "amount":
          comparison = (a.amount || 0) - (b.amount || 0)
          break
        case "employee":
          comparison = (a.employeeName || "").localeCompare(b.employeeName || "")
          break
      }
      return sortDirection === "asc" ? comparison : -comparison
    })

    return filtered
  }, [stockLogs, searchQuery, typeFilter, itemFilter, dateRange, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "in":
        return <Badge className="bg-[var(--status-healthy)]/20 text-[var(--status-healthy)] border-[var(--status-healthy)]/30 rounded-sm">Stock In</Badge>
      case "out":
        return <Badge className="bg-muted text-muted-foreground border-border rounded-sm">Stock Out</Badge>
      case "waste":
        return <Badge className="bg-[var(--status-critical)]/20 text-[var(--status-critical)] border-[var(--status-critical)]/30 rounded-sm">Waste</Badge>
      case "opname":
        return <Badge className="bg-[var(--status-warning)]/20 text-[var(--status-warning)] border-[var(--status-warning)]/30 rounded-sm">Opname</Badge>
      default:
        return <Badge variant="secondary" className="rounded-sm">{type}</Badge>
    }
  }

  const exportToCSV = () => {
    const headers = ["Date", "Time", "Item", "Action", "Quantity", "Employee", "Notes"]
    const rows = filteredAndSortedLogs.map(log => [
      format(new Date(log.timestamp), "yyyy-MM-dd"),
      format(new Date(log.timestamp), "HH:mm:ss"),
      log.itemName,
      log.type,
      log.amount.toString(),
      log.employeeName,
      log.notes || ""
    ])

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const uniqueTypes = ["in", "out", "waste", "opname"]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Transaction History</h1>
          <p className="text-muted-foreground">Complete inventory transaction logs</p>
        </div>
        <Button onClick={exportToCSV} variant="outline" className="gap-2 rounded-sm">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="rounded-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-sm"
              />
            </div>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="rounded-sm">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type === "in" ? "Stock In" : type === "out" ? "Stock Out" : type === "opname" ? "Stock Opname" : type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Item Filter */}
            <Select value={itemFilter} onValueChange={setItemFilter}>
              <SelectTrigger className="rounded-sm">
                <SelectValue placeholder="Filter by item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                {inventory.map(item => (
                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal rounded-sm">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from && dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                    </>
                  ) : (
                    "Select date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-sm" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-sm">
          <CardContent className="pt-6">
            <div className="text-2xl font-light">{filteredAndSortedLogs.length}</div>
            <p className="text-xs text-muted-foreground">Total Transactions</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm">
          <CardContent className="pt-6">
            <div className="text-2xl font-light text-[var(--status-healthy)]">
              {filteredAndSortedLogs.filter(l => l.type === "in").length}
            </div>
            <p className="text-xs text-muted-foreground">Stock In</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm">
          <CardContent className="pt-6">
            <div className="text-2xl font-light text-muted-foreground">
              {filteredAndSortedLogs.filter(l => l.type === "out").length}
            </div>
            <p className="text-xs text-muted-foreground">Stock Out</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm">
          <CardContent className="pt-6">
            <div className="text-2xl font-light text-[var(--status-critical)]">
              {filteredAndSortedLogs.filter(l => l.type === "waste").length}
            </div>
            <p className="text-xs text-muted-foreground">Waste</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="rounded-sm">
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            Showing {filteredAndSortedLogs.length} of {stockLogs.length} transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort("timestamp")}
                      className="gap-1 -ml-3"
                    >
                      Date/Time
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort("item")}
                      className="gap-1 -ml-3"
                    >
                      Item
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort("type")}
                      className="gap-1 -ml-3"
                    >
                      Type
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort("amount")}
                      className="gap-1 -mr-3"
                    >
                      Amount
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort("employee")}
                      className="gap-1 -ml-3"
                    >
                      Employee
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No transactions found matching your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        <div>{format(new Date(log.timestamp), "MMM d, yyyy")}</div>
                        <div className="text-muted-foreground text-xs">
                          {format(new Date(log.timestamp), "HH:mm:ss")}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{log.itemName}</TableCell>
                      <TableCell>{getTypeBadge(log.type)}</TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={
                          log.type === "in" ? "text-[var(--status-healthy)]" :
                          log.type === "waste" ? "text-[var(--status-critical)]" :
                          log.type === "out" ? "text-muted-foreground" :
                          "text-[var(--status-warning)]"
                        }>
                          {log.type === "in" ? "+" : log.type === "opname" ? "=" : "-"}
                          {log.amount} {getItemUnit(log.itemId)}
                        </span>
                      </TableCell>
                      <TableCell>{log.employeeName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {log.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
