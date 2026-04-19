"use client"

import { useState, useEffect, useRef } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { getOvertimeRequests, getLowStockItems, getInventory, type OvertimeRequest } from "@/lib/api/supabase-service"
import { useRouter } from "next/navigation"

export function NotificationBell() {
  const [pendingOvertimes, setPendingOvertimes] = useState<OvertimeRequest[]>([])
  const [lowStockCount, setLowStockCount] = useState(0)
  const [hasNew, setHasNew] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  // Previous counts to detect *new* items for the sound
  const prevCountRef = useRef({ overtime: 0, stock: 0 })

  useEffect(() => {
    // Create audio element for the notification sound
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3') // Simple pop/bell sound
    
    let isMounted = true
    const checkNotifications = async () => {
      try {
        const [otData, inventoryData] = await Promise.all([
          getOvertimeRequests(),
          getInventory()
        ])
        const lowStockData = getLowStockItems(inventoryData)
        
        if (!isMounted) return
        
        const pending = otData.filter(req => req.status === 'pending')
        setPendingOvertimes(pending)
        setLowStockCount(lowStockData.length)
        
        const totalNow = pending.length + lowStockData.length
        const totalPrev = prevCountRef.current.overtime + prevCountRef.current.stock
        
        if (totalNow > 0) setHasNew(true)
          
        if (totalNow > totalPrev) {
          // Play sound if there's a NEW notification
          audioRef.current?.play().catch(e => console.log('Audio play failed:', e))
        }
        
        prevCountRef.current = { overtime: pending.length, stock: lowStockData.length }
      } catch (err) {
        console.error("Error checking notifications", err)
      }
    }
    
    // Check initially
    checkNotifications()
    
    // Polling every 30 seconds
    const intervalId = setInterval(checkNotifications, 30000)
    
    return () => {
      isMounted = false
      clearInterval(intervalId)
    }
  }, [])

  const totalNotifications = pendingOvertimes.length + (lowStockCount > 0 ? 1 : 0)

  return (
    <div className="relative z-50">
      <Popover open={isOpen} onOpenChange={(open) => {
        setIsOpen(open)
        if (open) setHasNew(false)
      }}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="relative rounded-full h-10 w-10 bg-background shadow-md overflow-visible border-border hover:bg-muted">
            <Bell className="w-5 h-5 text-foreground" />
            {hasNew && totalNotifications > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 items-center justify-center text-[9px] font-bold text-white leading-none">
                  {totalNotifications}
                </span>
              </span>
            )}
            {!hasNew && totalNotifications > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm leading-none">
                {totalNotifications}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0 rounded-md overflow-hidden shadow-lg border-border">
          <div className="bg-muted px-4 py-3 border-b border-border flex justify-between items-center">
            <h4 className="font-semibold text-sm">Notifications</h4>
            <Badge variant="secondary" className="rounded-sm text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100">{totalNotifications} New</Badge>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {totalNotifications === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">You are all caught up!</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {pendingOvertimes.length > 0 && (
                  <button 
                    onClick={() => {
                      setIsOpen(false)
                      router.push('/admin/attendance-report?tab=overtime')
                    }}
                    className="p-4 text-left hover:bg-muted/50 border-b border-border transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Pending Overtime Request</span>
                      <span className="text-xs text-muted-foreground">{pendingOvertimes.length}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You have {pendingOvertimes.length} overtime request(s) awaiting your approval.
                    </p>
                  </button>
                )}
                
                {lowStockCount > 0 && (
                  <button 
                    onClick={() => {
                      setIsOpen(false)
                      router.push('/admin/inventory')
                    }}
                    className="p-4 text-left hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm text-foreground group-hover:text-destructive transition-colors">Low Inventory Stock</span>
                      <span className="text-xs text-muted-foreground">{lowStockCount} Items</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lowStockCount} items have reached their minimum stock threshold.
                    </p>
                  </button>
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
