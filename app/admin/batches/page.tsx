"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
// Duplicate imports removed
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { 
  Package, 
  Search, 
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Archive,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  MoreVertical
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import {
  getBatches,
  getInventory,
  addBatch,
  stockOutManual,
  toBaseUnit,
  type DisplayUnit,
  type InventoryItem
} from "@/lib/api/supabase-service"
import {
  type InventoryBatch,
  type BatchMovement,
  type BatchStatus,
  getDaysUntilExpiry,
} from "@/lib/data"
import { useEffect } from "react"

const statusConfig: Record<BatchStatus, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: "Active", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: <CheckCircle className="w-3 h-3" /> },
  depleted: { label: "Depleted", color: "bg-neutral-500/10 text-neutral-600 border-neutral-500/20", icon: <Archive className="w-3 h-3" /> },
  expired: { label: "Expired", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: <XCircle className="w-3 h-3" /> },
  quarantined: { label: "Quarantined", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: <AlertTriangle className="w-3 h-3" /> },
}

const movementTypeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  in: { label: "Stock In", color: "text-emerald-600", icon: <ArrowDownRight className="w-4 h-4" /> },
  out: { label: "Stock Out", color: "text-blue-600", icon: <ArrowUpRight className="w-4 h-4" /> },
  waste: { label: "Waste", color: "text-red-600", icon: <Trash2 className="w-4 h-4" /> },
  adjustment: { label: "Adjustment", color: "text-amber-600", icon: <History className="w-4 h-4" /> },
  transfer: { label: "Transfer", color: "text-purple-600", icon: <Package className="w-4 h-4" /> },
}

export default function BatchesPage() {
  const { isSuperAdmin } = useAuth()
  const canEdit = isSuperAdmin()
  
  const [batches, setBatches] = useState<InventoryBatch[]>([])
  const [movements, setMovements] = useState<BatchMovement[]>([])
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedItem, setSelectedItem] = useState<string>("all")
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const [fetchedBatches, fetchedInventory] = await Promise.all([
        getBatches(),
        getInventory()
      ])
      const mappedBatches: InventoryBatch[] = fetchedBatches.map((b: any) => {
        let status: BatchStatus = "active"
        const remaining = Number(b.remaining_quantity)
        const daysToExpiry = getDaysUntilExpiry(b.expired_date)
        if (remaining <= 0) status = "depleted"
        else if (daysToExpiry <= 0) status = "expired"

        return {
          id: b.id,
          batchNumber: b.batch_number,
          inventoryItemId: b.item_id,
          inventoryItemName: b.inventory_items?.name || 'Unknown',
          supplier: b.supplier_name,
          initialQuantity: Number(b.quantity),
          currentQuantity: remaining,
          unitCost: Number(b.cost_per_unit),
          receivedDate: b.received_date,
          expiryDate: b.expired_date,
          status,
          notes: b.notes,
          createdAt: b.created_at,
          updatedAt: b.created_at
        }
      })
      
      setBatches(mappedBatches)
      setInventoryList(fetchedInventory)
      setIsLoading(false)
    }
    fetchData()
  }, [])

  
  // Record Movement form state
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [movementForm, setMovementForm] = useState({
    batchId: "",
    itemId: "",
    quantity: "",
    unit: "pcs" as DisplayUnit,
    type: "out" as "in" | "out" | "waste" | "adjustment",
    reason: "",
    notes: ""
  })
  const [movementError, setMovementError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter batches
  const filteredBatches = batches.filter((batch) => {
    const matchesSearch = 
      (batch.batchNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (batch.inventoryItemName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (batch.supplier || "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = selectedStatus === "all" || batch.status === selectedStatus
    const matchesItem = selectedItem === "all" || batch.inventoryItemId === selectedItem
    return matchesSearch && matchesStatus && matchesItem
  })

  // Get expiring soon batches (within 7 days)
  const expiringBatches = batches.filter((batch) => {
    if (batch.status !== "active") return false
    const days = getDaysUntilExpiry(batch.expiryDate)
    return days > 0 && days <= 7
  })

  // Get expired batches
  const expiredBatches = batches.filter((batch) => {
    return batch.status === "expired" || getDaysUntilExpiry(batch.expiryDate) <= 0
  })

  // Stats
  const totalBatches = batches.filter(b => b.status === "active").length
  const lowStockBatches = batches.filter(b => b.status === "active" && b.currentQuantity < b.initialQuantity * 0.2).length

  // Handle Record Movement submission
  const handleRecordMovement = async () => {
    if (!movementForm.batchId || !movementForm.quantity) return
    setMovementError("")
    setIsSubmitting(true)
    
    const batch = batches.find(b => b.id === movementForm.batchId)
    if (!batch) {
      setMovementError("Batch not found")
      setIsSubmitting(false)
      return
    }
    
    const quantity = parseFloat(movementForm.quantity) || 0
    
    try {
      // Update batch quantity locally
      setBatches(prev => prev.map(b => {
        if (b.id !== movementForm.batchId) return b
        
        let newQuantity = b.currentQuantity
        if (movementForm.type === "in") {
          newQuantity += quantity
        } else {
          newQuantity = Math.max(0, newQuantity - quantity)
        }
        
        return {
          ...b,
          currentQuantity: newQuantity,
          status: newQuantity <= 0 ? "depleted" : b.status,
          updatedAt: new Date().toISOString(),
        }
      }))
      
      // Add movement record locally
      const newMovement: BatchMovement = {
        id: `bm-${Date.now()}`,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        inventoryItemId: (batch.inventoryItemId as unknown) as string,
        inventoryItemName: batch.inventoryItemName,
        type: movementForm.type,
        quantity,
        employeeId: "emp-admin",
        employeeName: "Admin",
        reason: movementForm.reason,
        notes: movementForm.notes,
        timestamp: new Date().toISOString(),
      }
      setMovements(prev => [newMovement, ...prev])
      
      // Also call stockOutManual for OUT/waste types to update inventory
      if (movementForm.type === "out" || movementForm.type === "waste") {
        const quantityConverted = toBaseUnit(quantity, movementForm.unit)
        await stockOutManual(
          batch.inventoryItemId,
          quantityConverted,
          movementForm.reason || movementForm.notes || "Batch movement"
        )
      }
      
      // Reset form and close modal
      setMovementForm({
        batchId: "",
        itemId: "",
        quantity: "",
        unit: "pcs",
        type: "out",
        reason: "",
        notes: ""
      })
      setIsMovementModalOpen(false)
    } catch (error) {
      setMovementError("An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const openBatchDetail = (batch: InventoryBatch) => {
    setSelectedBatch(batch)
    setIsDetailModalOpen(true)
  }

  const getBatchMovements = (batchId: string) => {
    return movements
      .filter(m => m.batchId === batchId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header - VIEW ONLY (Add Batch moved to Inventory) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Batch Tracking</h1>
          <p className="text-sm text-muted-foreground">View inventory batches with FIFO tracking and expiry monitoring (View Only - Add Stock via Inventory)</p>
        </div>
        {/* Record Movement button - only for existing batches */}
        <Button 
          className="rounded-sm"
          onClick={() => {
            setMovementForm({ batchId: "", itemId: "", quantity: "", unit: "pcs" as DisplayUnit, type: "out" as any, reason: "", notes: "" })
            setMovementError("")
            setIsMovementModalOpen(true)
          }}
        >
          <History className="w-4 h-4 mr-2" />
          Record Movement
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="rounded-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-primary/10">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{totalBatches}</p>
                <p className="text-xs text-muted-foreground">Active Batches</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{expiringBatches.length}</p>
                <p className="text-xs text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-red-500/10">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{expiredBatches.length}</p>
                <p className="text-xs text-muted-foreground">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-orange-500/10">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{lowStockBatches}</p>
                <p className="text-xs text-muted-foreground">Low Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Soon Alert */}
      {expiringBatches.length > 0 && (
        <Card className="rounded-sm border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              Batches Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {expiringBatches.slice(0, 5).map((batch) => (
                <Badge 
                  key={batch.id} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-amber-500/10"
                  onClick={() => openBatchDetail(batch)}
                >
                  {batch.batchNumber} - {getDaysUntilExpiry(batch.expiryDate)} days left
                </Badge>
              ))}
              {expiringBatches.length > 5 && (
                <Badge variant="outline">+{expiringBatches.length - 5} more</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="batches" className="w-full">
        <TabsList className="rounded-sm">
          <TabsTrigger value="batches" className="rounded-sm">All Batches</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-sm">Movement History</TabsTrigger>
        </TabsList>

        <TabsContent value="batches" className="mt-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 mb-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search batch number, item, or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-sm"
              />
            </div>
            <Select value={selectedItem} onValueChange={setSelectedItem}>
              <SelectTrigger className="w-full sm:w-48 rounded-sm">
                <SelectValue placeholder="Filter by item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                {inventoryList.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-40 rounded-sm">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="depleted">Depleted</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="quarantined">Quarantined</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Batches Table */}
          <Card className="rounded-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Number</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No batches found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBatches.map((batch) => {
                    const daysUntilExpiry = getDaysUntilExpiry(batch.expiryDate)
                    const status = statusConfig[batch.status]
                    const usagePercent = ((batch.initialQuantity - batch.currentQuantity) / batch.initialQuantity) * 100
                    
                    return (
                      <TableRow 
                        key={batch.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openBatchDetail(batch)}
                      >
                        <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                        <TableCell>{batch.inventoryItemName}</TableCell>
                        <TableCell className="text-muted-foreground">{batch.supplier}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span>{batch.currentQuantity.toLocaleString()} / {batch.initialQuantity.toLocaleString()}</span>
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${100 - usagePercent}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{formatDate(batch.expiryDate)}</span>
                            {daysUntilExpiry <= 7 && daysUntilExpiry > 0 && (
                              <span className="text-xs text-amber-600">{daysUntilExpiry} days left</span>
                            )}
                            {daysUntilExpiry <= 0 && (
                              <span className="text-xs text-red-600">Expired</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("gap-1", status.color)}>
                            {status.icon}
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                openBatchDetail(batch)
                              }}>
                                View Details
                              </DropdownMenuItem>
                              {canEdit && batch.status === "active" && (
                                <>
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation()
                                    setMovementForm(prev => ({ ...prev, batchId: batch.id, itemId: batch.inventoryItemId }))
                                    setMovementError("")
                                    setIsMovementModalOpen(true)
                                  }}>
                                    Record Movement
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setBatches(prev => prev.map(b => 
                                        b.id === batch.id ? { ...b, status: "quarantined" } : b
                                      ))
                                    }}
                                  >
                                    Quarantine Batch
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          <Card className="rounded-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.slice(0, 50).map((movement) => {
                  const typeConfig = movementTypeConfig[movement.type]
                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(movement.timestamp)}
                      </TableCell>
                      <TableCell className="font-medium">{movement.batchNumber}</TableCell>
                      <TableCell>{movement.inventoryItemName}</TableCell>
                      <TableCell>
                        <div className={cn("flex items-center gap-1", typeConfig.color)}>
                          {typeConfig.icon}
                          <span>{typeConfig.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {movement.type === "in" ? "+" : "-"}{movement.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell>{movement.employeeName}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {movement.reason || movement.notes || "-"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Movement Modal */}
      <Dialog open={isMovementModalOpen} onOpenChange={setIsMovementModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Batch Movement</DialogTitle>
            <DialogDescription>
              Record stock in, out, waste, or adjustment for a batch
            </DialogDescription>
          </DialogHeader>
          {movementError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-sm">
              {movementError}
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Select Batch *</Label>
              <Select
                value={movementForm.batchId}
                onValueChange={(v) => setMovementForm(prev => ({ ...prev, batchId: v }))}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.filter(b => b.status === "active").map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.batchNumber} - {batch.inventoryItemName} ({batch.currentQuantity} remaining)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Movement Type *</Label>
                <Select
                  value={movementForm.type}
                  onValueChange={(v) => setMovementForm(prev => ({ ...prev, type: v as typeof movementForm.type }))}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="out">Stock Out</SelectItem>
                    <SelectItem value="waste">Waste</SelectItem>
                    <SelectItem value="in">Stock In (Return)</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="movementQuantity">Quantity *</Label>
                <Input
                  id="movementQuantity"
                  type="number"
                  placeholder="e.g. 100"
                  value={movementForm.quantity}
                  onChange={(e) => setMovementForm(prev => ({ ...prev, quantity: e.target.value }))}
                  className="rounded-sm"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                placeholder="e.g. Daily operations, Expired, etc."
                value={movementForm.reason}
                onChange={(e) => setMovementForm(prev => ({ ...prev, reason: e.target.value }))}
                className="rounded-sm"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="movementNotes">Notes</Label>
              <Input
                id="movementNotes"
                placeholder="Additional notes..."
                value={movementForm.notes}
                onChange={(e) => setMovementForm(prev => ({ ...prev, notes: e.target.value }))}
                className="rounded-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMovementModalOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button 
              onClick={handleRecordMovement} 
              disabled={!movementForm.batchId || !movementForm.quantity || isSubmitting}
              className="rounded-sm"
            >
              {isSubmitting ? "Recording..." : "Record Movement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Detail Modal - View Only */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedBatch && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Batch: {selectedBatch.batchNumber}
                </DialogTitle>
                <DialogDescription>
                  {selectedBatch.inventoryItemName} from {selectedBatch.supplier}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-6 py-4">
                {/* Batch Info */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant="outline" className={cn("mt-1", statusConfig[selectedBatch.status].color)}>
                      {statusConfig[selectedBatch.status].icon}
                      <span className="ml-1">{statusConfig[selectedBatch.status].label}</span>
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Qty</p>
                    <p className="text-lg font-semibold">{selectedBatch.currentQuantity.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Initial Qty</p>
                    <p className="text-lg font-semibold">{selectedBatch.initialQuantity.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Unit Cost</p>
                    <p className="text-lg font-semibold">{formatCurrency(selectedBatch.unitCost)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Received Date</p>
                    <p className="font-medium">{formatDate(selectedBatch.receivedDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expiry Date</p>
                    <p className="font-medium">{formatDate(selectedBatch.expiryDate)}</p>
                    {getDaysUntilExpiry(selectedBatch.expiryDate) <= 7 && getDaysUntilExpiry(selectedBatch.expiryDate) > 0 && (
                      <p className="text-xs text-amber-600">{getDaysUntilExpiry(selectedBatch.expiryDate)} days remaining</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Value</p>
                    <p className="font-medium">{formatCurrency(selectedBatch.currentQuantity * selectedBatch.unitCost)}</p>
                  </div>
                </div>

                {selectedBatch.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm">{selectedBatch.notes}</p>
                  </div>
                )}

                {/* Movement History */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Movement History
                  </h4>
                  <div className="border rounded-sm">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>By</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getBatchMovements(selectedBatch.id).map((movement) => {
                          const typeConfig = movementTypeConfig[movement.type]
                          return (
                            <TableRow key={movement.id}>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatDateTime(movement.timestamp)}
                              </TableCell>
                              <TableCell>
                                <div className={cn("flex items-center gap-1 text-sm", typeConfig.color)}>
                                  {typeConfig.icon}
                                  <span>{typeConfig.label}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {movement.type === "in" ? "+" : "-"}{movement.quantity}
                              </TableCell>
                              <TableCell className="text-sm">{movement.employeeName}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {movement.reason || movement.notes || "-"}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {getBatchMovements(selectedBatch.id).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                              No movements recorded
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDetailModalOpen(false)} className="rounded-sm">
                  Close
                </Button>
                {canEdit && selectedBatch.status === "active" && (
                  <Button 
                    onClick={() => {
                      setMovementForm(prev => ({ ...prev, batchId: selectedBatch.id }))
                      setIsDetailModalOpen(false)
                      setIsMovementModalOpen(true)
                    }}
                    className="rounded-sm"
                  >
                    Record Movement
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
