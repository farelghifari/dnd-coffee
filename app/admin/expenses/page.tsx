"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  getMonthlyOpex, 
  addMonthlyOpex, 
  deleteMonthlyOpex,
  type MonthlyOpex 
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Plus, 
  Trash2, 
  Receipt, 
  Calendar, 
  Tag, 
  FileText,
  AlertCircle,
  Filter
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format, startOfMonth } from "date-fns"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"

export default function ExpensesPage() {
  const { isMainSuperAdmin } = useAuth()
  const [opex, setOpex] = useState<MonthlyOpex[]>([])
  const [isLoading, setIsLoading] = useState(true)

  if (!isMainSuperAdmin()) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Only the Main Super Admin can manage expenses.</p>
      </div>
    )
  }
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"))
  
  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    notes: "",
    month: format(new Date(), "yyyy-MM")
  })

  const categories = [
    "Rent",
    "Electricity",
    "Water",
    "Internet/Wifi",
    "Supplies (Tissue, Cleaning, etc.)",
    "Maintenance",
    "Marketing",
    "Other"
  ]

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const data = await getMonthlyOpex(selectedMonth)
      setOpex(data)
    } catch (error) {
      console.error("Failed to fetch opex:", error)
      toast.error("Failed to load expenses")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedMonth])

  const handleAddOpex = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.category || !formData.amount) {
      toast.error("Please fill in category and amount")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await addMonthlyOpex({
        month: formData.month,
        category: formData.category,
        amount: parseFloat(formData.amount),
        notes: formData.notes
      })

      if (result) {
        toast.success("Expense added successfully")
        setIsAddModalOpen(false)
        setFormData({
          category: "",
          amount: "",
          notes: "",
          month: format(new Date(), "yyyy-MM")
        })
        fetchData()
      } else {
        toast.error("Failed to add expense")
      }
    } catch (error) {
      console.error(error)
      toast.error("An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteOpex = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return

    try {
      const success = await deleteMonthlyOpex(id)
      if (success) {
        toast.success("Expense deleted")
        fetchData()
      } else {
        toast.error("Failed to delete expense")
      }
    } catch (error) {
      console.error(error)
      toast.error("An error occurred")
    }
  }

  const totalAmount = useMemo(() => {
    return opex.reduce((sum, item) => sum + item.amount, 0)
  }, [opex])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">Manage operational costs and monthly bills</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-sm border border-border/50">
            <Filter className="w-4 h-4 ml-2 text-muted-foreground" />
            <Input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border-none bg-transparent h-8 w-[140px] focus-visible:ring-0"
            />
          </div>
          
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-sm gap-2">
                <Plus className="w-4 h-4" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Monthly Expense</DialogTitle>
                <DialogDescription>
                  Record a new operational cost for {format(new Date(selectedMonth + "-02"), "MMMM yyyy")}.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddOpex} className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="month">Month</Label>
                  <Input 
                    id="month" 
                    type="month" 
                    value={formData.month} 
                    onChange={(e) => setFormData({...formData, month: e.target.value})}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(val) => setFormData({...formData, category: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount (IDR)</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    placeholder="e.g. 1000000"
                    value={formData.amount} 
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input 
                    id="notes" 
                    placeholder="e.g. Paid via Bank Transfer"
                    value={formData.notes} 
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
                <DialogFooter className="mt-4">
                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? "Saving..." : "Save Expense"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 h-fit rounded-sm shadow-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatPrice(totalAmount)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              For {format(new Date(selectedMonth + "-02"), "MMMM yyyy")}
            </p>
            
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 text-amber-700 rounded-sm border border-amber-500/20 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>These costs directly reduce your Net Profit in Analytics.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 rounded-sm shadow-sm border-border/50 overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
              </div>
            ) : opex.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                <Receipt className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No expenses recorded for this month</p>
                <p className="text-xs text-muted-foreground mt-1">Click "Add Expense" to record your first operational cost.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-left">
                      <th className="p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Category</th>
                      <th className="p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Notes</th>
                      <th className="p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Date Recorded</th>
                      <th className="p-4 font-medium text-xs text-muted-foreground uppercase tracking-wider text-right">Amount</th>
                      <th className="p-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {opex.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{item.category}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground italic">
                          {item.notes || "-"}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {format(new Date(item.created_at || new Date()), "MMM d, yyyy")}
                        </td>
                        <td className="p-4 text-right font-mono text-sm font-bold">
                          {formatPrice(item.amount)}
                        </td>
                        <td className="p-4">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteOpex(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
