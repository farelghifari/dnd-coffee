"use client"

import { useState, useMemo } from "react"
import { X, Minus, Plus, Check, AlertTriangle, Layers, Clock, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { type InventoryItem } from "@/lib/api/supabase-service"
import { 
  inventoryBatches, 
  type InventoryBatch, 
  getDaysUntilExpiry 
} from "@/lib/data"
import { Badge } from "@/components/ui/badge"

interface StockActionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { itemId: string; amount: number; notes?: string; batchId?: string }) => void
  actionType: "stock-in" | "stock-out" | "waste" | "opname" | null
  title: string
  inventory: InventoryItem[]
}

export function StockActionModal({ isOpen, onClose, onSubmit, actionType, title, inventory }: StockActionModalProps) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [amount, setAmount] = useState(0)
  const [notes, setNotes] = useState("")
  const [step, setStep] = useState<"select" | "batch" | "amount">("select")

  // Get batches for selected item (FIFO - oldest first)
  const availableBatches = useMemo(() => {
    if (!selectedItem) return []
    return inventoryBatches
      .filter(batch => 
        batch.inventoryItemId === selectedItem && 
        batch.status === "active" && 
        batch.currentQuantity > 0
      )
      .sort((a, b) => new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime())
  }, [selectedItem])

  // Check if item has batches
  const hasBatches = availableBatches.length > 0

  // For stock-out and waste, we need to select a batch if available
  const requiresBatchSelection = (actionType === "stock-out" || actionType === "waste") && hasBatches

  const handleItemSelect = (itemId: string) => {
    setSelectedItem(itemId)
    setSelectedBatch(null)
    setAmount(0)
    setNotes("")
    
    // Check if this item has batches and needs batch selection
    const itemBatches = inventoryBatches.filter(batch => 
      batch.inventoryItemId === itemId && 
      batch.status === "active" && 
      batch.currentQuantity > 0
    )
    
    if ((actionType === "stock-out" || actionType === "waste") && itemBatches.length > 0) {
      setStep("batch")
    } else {
      setStep("amount")
    }
  }

  const handleBatchSelect = (batchId: string) => {
    setSelectedBatch(batchId)
    setStep("amount")
    setAmount(0)
  }

  const handleSubmit = () => {
    if (selectedItem && amount > 0) {
      onSubmit({ 
        itemId: selectedItem, 
        amount, 
        notes: notes || undefined,
        batchId: selectedBatch || undefined
      })
      // Reset state
      setSelectedItem(null)
      setSelectedBatch(null)
      setAmount(0)
      setNotes("")
      setStep("select")
    }
  }

  const handleClose = () => {
    setSelectedItem(null)
    setSelectedBatch(null)
    setAmount(0)
    setNotes("")
    setStep("select")
    onClose()
  }

  const handleBack = () => {
    if (step === "amount" && requiresBatchSelection) {
      setStep("batch")
      setSelectedBatch(null)
    } else if (step === "amount" || step === "batch") {
      setStep("select")
      setSelectedItem(null)
      setSelectedBatch(null)
    } else {
      handleClose()
    }
  }

  const selectedInventoryItem = inventory.find((i) => i.id === selectedItem)
  const selectedBatchItem = selectedBatch ? inventoryBatches.find(b => b.id === selectedBatch) : null
  
  // Get max available - either from batch or from item stock
  const maxAvailable = selectedBatchItem 
    ? selectedBatchItem.currentQuantity 
    : selectedInventoryItem?.current_stock || 0
  
  // Check if amount exceeds available stock for out/waste
  const exceedsStock = selectedInventoryItem && 
    (actionType === "stock-out" || actionType === "waste") && 
    amount > maxAvailable

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-muted rounded-sm transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-medium">{title}</h2>
        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {step === "select" ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">Select an item</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
              {inventory.map((item) => {
                const itemBatches = inventoryBatches.filter(b => 
                  b.inventoryItemId === item.id && 
                  b.status === "active" && 
                  b.currentQuantity > 0
                )
                const hasBatches = itemBatches.length > 0
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemSelect(item.id)}
                    className="p-4 rounded-sm border border-border hover:border-foreground/50 text-left transition-colors relative"
                  >
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Current: {item.current_stock} {item.unit}
                    </p>
                    {hasBatches && (actionType === "stock-out" || actionType === "waste") && (
                      <div className="flex items-center gap-1 mt-2">
                        <Layers className="w-3 h-3 text-primary" />
                        <span className="text-xs text-primary">{itemBatches.length} batch{itemBatches.length > 1 ? "es" : ""}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : step === "batch" ? (
          <div className="space-y-4 max-w-lg mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl font-medium">{selectedInventoryItem?.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">Select a batch (FIFO recommended)</p>
            </div>
            
            <div className="space-y-2">
              {availableBatches.map((batch, index) => {
                const daysUntilExpiry = getDaysUntilExpiry(batch.expiryDate)
                const isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry > 0
                const isExpired = daysUntilExpiry <= 0
                
                return (
                  <button
                    key={batch.id}
                    onClick={() => handleBatchSelect(batch.id)}
                    className={cn(
                      "w-full p-4 rounded-sm border text-left transition-colors flex items-center justify-between",
                      index === 0 
                        ? "border-primary bg-primary/5 hover:bg-primary/10" 
                        : "border-border hover:border-foreground/50"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{batch.batchNumber}</span>
                        {index === 0 && (
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                            FIFO
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Supplier: {batch.supplier}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="text-muted-foreground">
                          Qty: <span className="font-medium text-foreground">{batch.currentQuantity}</span>
                        </span>
                        <span className={cn(
                          isExpired ? "text-red-600" : isExpiringSoon ? "text-amber-600" : "text-muted-foreground"
                        )}>
                          <Clock className="w-3 h-3 inline mr-1" />
                          {isExpired ? "Expired" : `Exp: ${formatDate(batch.expiryDate)}`}
                          {isExpiringSoon && ` (${daysUntilExpiry}d)`}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                )
              })}
            </div>

            {/* Skip batch selection option */}
            <button
              onClick={() => {
                setSelectedBatch(null)
                setStep("amount")
              }}
              className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip batch selection
            </button>
          </div>
        ) : (
          <div className="max-w-md mx-auto space-y-8">
            {/* Selected Item Info */}
            <div className="text-center">
              <h3 className="text-xl font-medium">{selectedInventoryItem?.name}</h3>
              {selectedBatchItem ? (
                <div className="mt-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    <Layers className="w-3 h-3 mr-1" />
                    {selectedBatchItem.batchNumber}
                  </Badge>
                  <p className="text-muted-foreground text-sm mt-2">
                    Available: {selectedBatchItem.currentQuantity} {selectedInventoryItem?.unit}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Current stock: {selectedInventoryItem?.current_stock} {selectedInventoryItem?.unit}
                </p>
              )}
            </div>

            {/* Amount Input */}
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {actionType === "opname" ? "Enter actual count" : "Enter amount"}
              </p>
              
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={() => setAmount(Math.max(0, amount - 1))}
                  className="w-16 h-16 rounded-sm bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                >
                  <Minus className="w-8 h-8" />
                </button>
                
                <div className="w-32 text-center">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className={cn(
                      "w-full text-center text-5xl font-light bg-transparent border-none outline-none",
                      exceedsStock && "text-[var(--status-critical)]"
                    )}
                  />
                  <p className="text-muted-foreground text-sm mt-1">
                    {selectedInventoryItem?.unit}
                  </p>
                </div>
                
                <button
                  onClick={() => setAmount(amount + 1)}
                  className="w-16 h-16 rounded-sm bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                >
                  <Plus className="w-8 h-8" />
                </button>
              </div>

              {/* Warning for exceeding stock */}
              {exceedsStock && (
                <div className="flex items-center justify-center gap-2 text-[var(--status-critical)] text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Amount exceeds available stock{selectedBatchItem ? " in batch" : ""}</span>
                </div>
              )}

              {/* Quick amount buttons */}
              <div className="flex justify-center gap-2 flex-wrap">
                {[5, 10, 50, 100].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(amount + val)}
                    className="px-4 py-2 rounded-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm transition-colors"
                  >
                    +{val}
                  </button>
                ))}
              </div>

              {/* Use all from batch */}
              {selectedBatchItem && (
                <div className="flex justify-center">
                  <button
                    onClick={() => setAmount(selectedBatchItem.currentQuantity)}
                    className="px-4 py-2 rounded-sm bg-primary/10 text-primary hover:bg-primary/20 text-sm transition-colors"
                  >
                    Use all ({selectedBatchItem.currentQuantity})
                  </button>
                </div>
              )}
            </div>

            {/* Notes Input */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes..."
                className="w-full p-3 rounded-sm border border-border bg-background resize-none h-24"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {step === "amount" && (
        <div className="p-4 border-t border-border">
          <button
            onClick={handleSubmit}
            disabled={amount === 0 || exceedsStock}
            className={cn(
              "w-full py-4 rounded-sm text-lg font-medium flex items-center justify-center gap-2 transition-colors",
              amount > 0 && !exceedsStock
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <Check className="w-5 h-5" />
            Confirm {title}
          </button>
        </div>
      )}
    </div>
  )
}
