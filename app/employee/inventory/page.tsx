"use client"

import { useState, useEffect } from "react"
import { 
  getInventory, 
  getInventoryOpnames,
  addInventoryOpname,
  subscribeToInventoryItems,
  fromBaseUnit,
  getConversionRate,
  getAllowedUnitsForItem,
  getDefaultDisplayUnit,
  type InventoryItem,
  type InventoryOpname,
  type DisplayUnit
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { 
  ClipboardCheck,
  History,
  ArrowLeft,
  Search,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import Link from "next/link"

const DEFAULT_CATEGORIES = ["beans", "milk", "syrup", "cups", "food", "other"]

export default function EmployeeInventoryOpnamePage() {
  const { user } = useAuth()
  const actorName = user?.name || user?.nickname || "System"
  
  const [activeTab, setActiveTab] = useState("opname")
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [opnameHistory, setOpnameHistory] = useState<InventoryOpname[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // History Filters
  const [historyFilterMode, setHistoryFilterMode] = useState<"single" | "range">("single")
  const [historyDate, setHistoryDate] = useState<Date>(new Date())
  const [historyDateRange, setHistoryDateRange] = useState({ 
    from: new Date().toISOString().split('T')[0], 
    to: new Date().toISOString().split('T')[0] 
  })
  const [historySearchTerm, setHistorySearchTerm] = useState("")

  // Bulk Opname State
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [bulkOpname, setBulkOpname] = useState<Record<string, { actualStock: string, displayUnit: DisplayUnit, reason: string, notes: string }>>({})

  // Dynamic categories
  const allCategoryOptions = Array.from(new Set([
    ...DEFAULT_CATEGORIES,
    ...inventory.map(i => i.category).filter(Boolean)
  ])).sort()
  const inventoryCategories = ["all", ...allCategoryOptions]

  useEffect(() => {
    fetchData()
    const unsubscribeInventory = subscribeToInventoryItems(() => fetchData())
    return () => {
      unsubscribeInventory()
    }
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [invData, opnameData] = await Promise.all([
        getInventory(),
        getInventoryOpnames(),
      ])
      
      console.log("[DEBUG] Fetched opname history count:", opnameData?.length);
      if (opnameData?.length > 0) {
        console.log("[DEBUG] First history item created_at:", opnameData[0].created_at);
      }
      
      setInventory(invData)
      setOpnameHistory(opnameData)
    } catch (err) {
      console.error("Error fetching data:", err)
      toast.error("Failed to load inventory data")
    } finally {
      setIsLoading(false)
    }
  }

  const getTheoreticalStock = (item: InventoryItem, displayUnit: DisplayUnit) => {
      const val = fromBaseUnit(item.stock ?? 0, displayUnit, item)
      return parseFloat(val.toFixed(4))
  }

  const updateBulkOpname = (itemId: string, field: string, value: any) => {
    setBulkOpname(prev => {
      const existing = prev[itemId] || {
        actualStock: "",
        displayUnit: inventory.find(i => i.id === itemId)?.display_unit as DisplayUnit || getDefaultDisplayUnit(inventory.find(i => i.id === itemId)?.unit || 'pcs'),
        reason: "",
        notes: ""
      }
      return {
        ...prev,
        [itemId]: { ...existing, [field]: value }
      }
    })
  }

  const validOpnames = Object.entries(bulkOpname).filter(([id, data]) => {
    if (data.actualStock === "") return false
    return inventory.some(i => i.id === id)
  })

  // We no longer have invalid opnames since reason is optional
  const invalidOpnames: [string, any][] = []

  const handleSubmitBulk = async () => {
    if (validOpnames.length === 0) return
    
    setIsLoading(true)
    try {
      const promises = validOpnames.map(([id, data]) => {
        const item = inventory.find(i => i.id === id)!
        const theoretical = item.stock || 0
        const multiplier = (item.display_unit === data.displayUnit && item.conversion_rate) ? 
          item.conversion_rate : 
          getConversionRate(data.displayUnit, item.unit) || 1;
          
        const actual = parseFloat(data.actualStock) * multiplier
        
        let finalReason = data.reason;
        if (data.notes) {
           finalReason = finalReason ? `${finalReason} - ${data.notes}` : data.notes;
        }

        return addInventoryOpname({
          item_id: id,
          theoretical_stock: theoretical,
          actual_stock: actual,
          difference: actual - theoretical,
          reason: finalReason,
          actor_name: actorName
        })
      })

      const results = await Promise.all(promises)
      const successCount = results.filter(r => r !== null).length
      const failedCount = results.length - successCount

      if (successCount > 0) {
        toast.success(`${successCount} item berhasil dicatat`)
      }
      
      if (failedCount > 0) {
        toast.error(`${failedCount} item gagal dicatat. Silakan cek koneksi atau database.`)
      }
      setBulkOpname({}) // reset form
      await fetchData()
    } catch (err) {
      toast.error("Gagal mencatat stock opname")
    } finally {
      setIsLoading(false)
    }
  }

  const totalToSubmit = validOpnames.length
  const hasInvalid = invalidOpnames.length > 0

  if (isLoading && inventory.length === 0) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/employee">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Opname</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">
            Verifikasi fisik stok secara langsung di outlet.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-2">
          <TabsTrigger value="opname" className="gap-2">
            <ClipboardCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Stock</span> Take
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="opname" className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scroll-bar">
            {inventoryCategories.map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                className={cn("rounded-full capitalize whitespace-nowrap", selectedCategory === cat && "bg-primary text-primary-foreground")}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === "all" ? "Semua" : cat}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {inventory
              .filter(i => i.status !== 'inactive')
              .filter(i => selectedCategory === "all" || i.category === selectedCategory)
              .map(item => {
               const opnameData = bulkOpname[item.id] || { 
                  actualStock: "", 
                  displayUnit: item.display_unit as DisplayUnit || getDefaultDisplayUnit(item.unit) || item.unit, 
                  reason: "",
                  notes: ""
               }
               const theoretical = getTheoreticalStock(item, opnameData.displayUnit)
               const actualNum = parseFloat(opnameData.actualStock)
               const hasActual = opnameData.actualStock !== ""
               const diff = hasActual ? parseFloat((actualNum - theoretical).toFixed(4)) : 0

               return (
                 <Card key={item.id} className={cn("rounded-lg border-2 shadow-sm transition-all", hasActual ? "border-primary/50 shadow-md bg-primary/[0.02]" : "border-border/50")}>
                    <CardHeader className="py-2.5 bg-muted/20 pb-2.5 px-4 mb-2 border-b border-border/50">
                      <CardTitle className="text-sm font-bold flex gap-2 justify-between items-start leading-tight">
                         <span>{item.name}</span>
                         <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap bg-background border border-border px-1.5 py-0.5 rounded-sm">Sys: {theoretical} {opnameData.displayUnit}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                      <div className="flex gap-2">
                         <div className="flex-1">
                           <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5 block">Stok Fisik</Label>
                           <Input 
                              type="number"
                              placeholder="0"
                              className="font-mono font-bold text-base h-10 border-primary/20 focus-visible:ring-primary/50"
                              value={opnameData.actualStock}
                              onChange={(e) => updateBulkOpname(item.id, "actualStock", e.target.value)}
                           />
                         </div>
                         <div className="w-[100px] sm:w-[120px]">
                           <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5 block">Satuan</Label>
                           <Select value={opnameData.displayUnit} onValueChange={(v) => updateBulkOpname(item.id, "displayUnit", v as DisplayUnit)}>
                             <SelectTrigger className="h-10 text-xs font-semibold uppercase bg-muted/30 border-muted-foreground/20"><SelectValue/></SelectTrigger>
                             <SelectContent>
                                {getAllowedUnitsForItem(item.unit).map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                             </SelectContent>
                           </Select>
                         </div>
                      </div>
                      
                      {hasActual && diff !== 0 && (
                        <div className="pt-2 animate-in fade-in slide-in-from-top-2 border-t border-border/50 mt-1">
                          <div className="flex justify-between items-center mb-2 px-2 py-1.5 rounded bg-muted/40 text-xs">
                            <span className="font-semibold text-muted-foreground">Selisih {diff < 0 ? "(Kurang)" : "(Lebih)"}</span>
                            <span className={cn("font-mono font-bold text-sm", diff < 0 ? "text-destructive" : "text-emerald-500")}>
                              {diff > 0 ? "+" : ""}{diff} {opnameData.displayUnit}
                            </span>
                          </div>
                          {diff < 0 ? (
                            <div className="space-y-2">
                              <Select value={opnameData.reason} onValueChange={(v) => updateBulkOpname(item.id, "reason", v)}>
                                <SelectTrigger className="h-10 text-xs font-medium">
                                  <SelectValue placeholder="Pilih alasan selisih kurang (Opsional)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Spoiled/Expired">Basi / Expired</SelectItem>
                                  <SelectItem value="Damaged">Rusak / Pecah</SelectItem>
                                  <SelectItem value="Operational Waste">Kebuang Operasional</SelectItem>
                                  <SelectItem value="Production Error">Salah Bikin</SelectItem>
                                  <SelectItem value="Shrinkage">Susut Alami / Shrinkage</SelectItem>
                                  <SelectItem value="Other">Lainnya</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input 
                                placeholder="Catatan detail (opsional)..." 
                                className="h-10 text-xs bg-muted/10 border-border/50" 
                                value={opnameData.notes}
                                onChange={(e) => updateBulkOpname(item.id, "notes", e.target.value)}
                              />
                            </div>
                          ) : (
                            <Input 
                              placeholder="Catatan tambahan (opsional)..." 
                              className="h-10 text-xs bg-muted/10" 
                              value={opnameData.reason}
                              onChange={(e) => updateBulkOpname(item.id, "reason", e.target.value)}
                            />
                          )}
                        </div>
                      )}
                      
                      {hasActual && diff === 0 && (
                        <div className="pt-2 animate-in fade-in flex items-center justify-center text-xs text-emerald-600 dark:text-emerald-500 bg-emerald-500/10 py-1.5 rounded-sm border border-emerald-500/20 font-medium">
                          Stok Sesuai (Aman)
                        </div>
                      )}
                    </CardContent>
                 </Card>
               )
            })}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="rounded-sm border-border overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="w-4 h-4"/> Riwayat Opname
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
               <div className="flex flex-col gap-3 p-4 sm:p-0 sm:pb-4 border-b border-border bg-muted/10">
                 <div className="flex flex-col sm:flex-row gap-2">
                   <div className="flex-1 relative">
                     <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                     <Input 
                       placeholder="Cari item..." 
                       className="pl-9 h-9 text-xs" 
                       value={historySearchTerm}
                       onChange={(e) => setHistorySearchTerm(e.target.value)}
                     />
                   </div>
                   <Select value={historyFilterMode} onValueChange={(v: "single" | "range") => setHistoryFilterMode(v)}>
                     <SelectTrigger className="w-[140px] h-9 text-xs bg-background">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="single">Per Hari</SelectItem>
                       <SelectItem value="range">Rentang Tanggal</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>

                 {historyFilterMode === "single" ? (
                   <div className="flex items-center justify-between sm:justify-start gap-2 bg-background p-1 border border-border rounded-md w-full sm:w-auto">
                     <Button variant="ghost" size="sm" onClick={() => {
                        const d = new Date(historyDate);
                        d.setDate(d.getDate() - 1);
                        setHistoryDate(d);
                     }}>
                       &lt;
                     </Button>
                     <Button variant="outline" size="sm" className="flex-1 sm:min-w-[130px] font-semibold text-xs" onClick={() => setHistoryDate(new Date())}>
                        {new Date().toDateString() === historyDate.toDateString() ? "Hari Ini" : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(historyDate)}
                     </Button>
                     <Button variant="ghost" size="sm" onClick={() => {
                         const d = new Date(historyDate);
                         d.setDate(d.getDate() + 1);
                         setHistoryDate(d);
                     }}>
                       &gt;
                     </Button>
                   </div>
                 ) : (
                   <div className="flex items-center gap-2 w-full sm:w-auto">
                     <Input 
                        type="date" 
                        value={historyDateRange.from} 
                        onChange={(e) => setHistoryDateRange(p => ({...p, from: e.target.value}))}
                        className="h-9 text-xs flex-1 sm:w-[130px]"
                     />
                     <span className="text-muted-foreground text-xs">-</span>
                     <Input 
                        type="date" 
                        value={historyDateRange.to} 
                        onChange={(e) => setHistoryDateRange(p => ({...p, to: e.target.value}))}
                        className="h-9 text-xs flex-1 sm:w-[130px]"
                     />
                   </div>
                 )}
               </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px] mb-4 sm:mb-0">
                  <thead className="bg-muted/50 hidden sm:table-header-group">
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Tanggal</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Item</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Selisih</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let filtered = opnameHistory.filter(opname => {
                         const item = inventory.find(i => i.id === opname.item_id);
                         if (historySearchTerm && item && !item.name.toLowerCase().includes(historySearchTerm.toLowerCase())) {
                           return false;
                         }

                         // Normalize created_at for robust date parsing (consistent with renderer)
                         let normalized = opname.created_at;
                         if (normalized.includes(' ')) normalized = normalized.replace(' ', 'T');
                         if (!normalized.includes('Z') && !normalized.includes('+')) normalized += 'Z';
                         const opDate = new Date(normalized);

                         if (historyFilterMode === "single") {
                            return opDate.getFullYear() === historyDate.getFullYear() &&
                                   opDate.getMonth() === historyDate.getMonth() &&
                                   opDate.getDate() === historyDate.getDate();
                         } else {
                            if (historyDateRange.from) {
                              const fromD = new Date(historyDateRange.from);
                              fromD.setHours(0,0,0,0);
                              if (opDate < fromD) return false;
                            }
                            if (historyDateRange.to) {
                              const toD = new Date(historyDateRange.to);
                              toD.setHours(23,59,59,999);
                              if (opDate > toD) return false;
                            }
                            return true;
                         }
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={4} className="py-12">
                              <div className="text-center text-muted-foreground flex flex-col items-center justify-center w-full">
                                 <ClipboardCheck className="w-8 h-8 opacity-20 mb-2" />
                                 Tidak ada riwayat pada filter yang dipilih.
                              </div>
                            </td>
                          </tr>
                        )
                      }
                      
                      return filtered.map((opname) => {
                        const item = inventory.find(i => i.id === opname.item_id);
                        const dUnit = (item?.display_unit || getDefaultDisplayUnit(item?.unit || 'pcs') || item?.unit || 'pcs') as DisplayUnit;
                        let multiplier = item?.conversion_rate || 1;
                        if (multiplier === 1 && dUnit.toLowerCase() !== (item?.unit || '').toLowerCase()) {
                          multiplier = getConversionRate(dUnit, item?.unit || 'pcs');
                        }
                        
                        const actualQty = parseFloat(((opname.actual_stock || 0) / multiplier).toFixed(4));
                        const theoQty = parseFloat(((opname.theoretical_stock || 0) / multiplier).toFixed(4));
                        const diffQty = parseFloat(((opname.difference || 0) / multiplier).toFixed(4));

                        return (
                          <tr key={opname.id} className="border-b border-border hover:bg-muted/30 flex flex-col sm:table-row p-3 sm:p-0">
                            <td className="py-1 sm:py-4 px-2 sm:px-4 text-xs font-mono text-muted-foreground">
                              {(() => {
                                let normalized = opname.created_at;
                                if (normalized.includes(' ')) normalized = normalized.replace(' ', 'T');
                                if (!normalized.includes('Z') && !normalized.includes('+')) normalized += 'Z';
                                const date = new Date(normalized);
                                return new Intl.DateTimeFormat('id-ID', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                 hour12: false
                                }).format(date).replace(/\./g, ':');
                              })()}
                            </td>
                            <td className="py-1 sm:py-4 px-2 sm:px-4">
                              <div className="font-semibold text-sm">{item?.name || "Unknown"}</div>
                              <div className="text-[10px] text-muted-foreground sm:hidden">
                                Sys: {theoQty} → Act: {actualQty}
                              </div>
                            </td>
                            <td className="py-1 sm:py-4 px-2 sm:px-4 sm:text-right hidden sm:table-cell">
                              <div className="flex flex-col gap-1 items-end">
                                <span className={cn(
                                  "font-bold font-mono text-xs px-2 py-0.5 rounded-full w-fit",
                                  opname.difference < 0 ? 'bg-destructive/10 text-destructive' : 
                                  opname.difference > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-foreground'
                                )}>
                                  {opname.difference > 0 ? '+' : ''}{diffQty} {dUnit}
                                </span>
                                <span className="text-[10px] text-muted-foreground opacity-60">S: {theoQty} | A: {actualQty}</span>
                              </div>
                            </td>
                            <td className="py-1 sm:py-4 px-2 sm:px-4 sm:hidden">
                                <span className={cn(
                                  "font-bold font-mono text-[10px] px-2 py-0.5 rounded-full inline-block mb-1",
                                  opname.difference < 0 ? 'bg-destructive/10 text-destructive' : 
                                  opname.difference > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-foreground'
                                )}>
                                  {opname.difference > 0 ? '+' : ''}{diffQty} {dUnit}
                                </span>
                            </td>
                            <td className="py-1 sm:py-4 px-2 sm:px-4 text-xs text-muted-foreground leading-tight" title={opname.reason || ""}>
                              {opname.reason || "-"}
                            </td>
                          </tr>
                        );
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {totalToSubmit > 0 && activeTab === "opname" && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] z-50 animate-in slide-in-from-bottom-5">
           <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-bold text-sm sm:text-base">{totalToSubmit} Item Siap Opname</span>
                {hasInvalid && <span className="text-[10px] text-destructive tracking-widest uppercase font-bold animate-pulse">{invalidOpnames.length} Item Butuh Alasan!</span>}
              </div>
              <Button 
                 size="lg" 
                 className="font-bold tracking-wide"
                 onClick={handleSubmitBulk}
                 disabled={hasInvalid || isLoading}
              >
                 {isLoading ? "Menyimpan..." : `Simpan Semua (${totalToSubmit})`}
              </Button>
           </div>
        </div>
      )}
    </div>
  )
}
