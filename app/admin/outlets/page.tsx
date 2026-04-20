"use client"

import { useState, useEffect } from "react"
import { 
  getOutlets, 
  addOutlet, 
  updateOutlet,
  getEmployees,
  updateEmployee,
  type Outlet,
  type Employee 
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  AlertCircle,
  LocateFixed,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Search,
  Lock,
  Unlock,
  RefreshCcw,
  SmartphoneNfc,
  MapPin,
  Plus,
  Settings2,
  Save,
  X,
  Navigation,
  CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function OutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Employee/Security state
  const [employees, setEmployees] = useState<Employee[]>([])
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState("")
  const [isUpdatingEmployee, setIsUpdatingEmployee] = useState<string | null>(null)
  
  // Form state
  const [form, setForm] = useState({
    name: "",
    latitude: "",
    longitude: "",
    radius_meters: "100",
    image_url: "",
    is_active: true
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    const [outletsData, employeesData] = await Promise.all([
      getOutlets(),
      getEmployees()
    ])
    setOutlets(outletsData)
    setEmployees(employeesData)
    setIsLoading(false)
  }

  const handleLockDevice = async (empId: string, deviceId: string | null) => {
    if (!deviceId) {
      toast.error("No device ID recorded for this employee yet.")
      return
    }
    
    setIsUpdatingEmployee(empId)
    const result = await updateEmployee(empId, { registered_device: deviceId })
    if (result) {
      toast.success("Device locked successfully")
      const updated = await getEmployees()
      setEmployees(updated)
    }
    setIsUpdatingEmployee(null)
  }

  const handleUnlockDevice = async (empId: string) => {
    setIsUpdatingEmployee(empId)
    const result = await updateEmployee(empId, { registered_device: null })
    if (result) {
      toast.success("Device unlocked successfully")
      const updated = await getEmployees()
      setEmployees(updated)
    }
    setIsUpdatingEmployee(null)
  }

  const handleResetForm = () => {
    setForm({
      name: "",
      latitude: "",
      longitude: "",
      radius_meters: "100",
      image_url: "",
      is_active: true
    })
    setIsAdding(false)
    setEditingId(null)
  }

  const handleEdit = (outlet: Outlet) => {
    setForm({
      name: outlet.name,
      latitude: outlet.latitude.toString(),
      longitude: outlet.longitude.toString(),
      radius_meters: outlet.radius_meters.toString(),
      image_url: outlet.image_url || "",
      is_active: outlet.is_active
    })
    setEditingId(outlet.id)
    setIsAdding(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const outletData = {
      name: form.name,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      radius_meters: parseInt(form.radius_meters),
      image_url: form.image_url,
      is_active: form.is_active
    }

    if (isNaN(outletData.latitude) || isNaN(outletData.longitude) || isNaN(outletData.radius_meters)) {
      toast.error("Invalid coordinates or radius")
      return
    }

    try {
      if (editingId) {
        await updateOutlet(editingId, outletData)
        toast.success("Outlet updated successfully")
      } else {
        await addOutlet(outletData)
        toast.success("Outlet added successfully")
      }
      handleResetForm()
      fetchData()
    } catch (error) {
      toast.error("Failed to save outlet")
    }
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser")
      return
    }

    toast.info("Fetching current location...")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm(prev => ({
          ...prev,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString()
        }))
        toast.success("Location captured!")
      },
      (error) => {
        toast.error(`Error: ${error.message}`)
      },
      { enableHighAccuracy: true }
    )
  }

  if (isLoading && outlets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outlet & Security</h1>
          <p className="text-muted-foreground">Manage physical locations and hardware access controls.</p>
        </div>
      </header>

      <Tabs defaultValue="locations" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] rounded-lg h-10 mb-4">
          <TabsTrigger value="locations" className="gap-2">
            <MapPin className="w-4 h-4" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <SmartphoneNfc className="w-4 h-4" />
            Hardware Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-end">
            {!isAdding && (
              <Button onClick={() => setIsAdding(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add New Outlet
              </Button>
            )}
          </div>

          {isAdding && (
            <Card className="border-primary/20 shadow-md animate-in slide-in-from-top-4 duration-300">
              {/* ... form content remains same ... */}
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {editingId ? <Settings2 className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                  {editingId ? "Edit Outlet" : "Register New Outlet"}
                </CardTitle>
                <CardDescription>
                  Set the name, coordinates, and geofence radius for this location.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Outlet Name</Label>
                      <Input 
                        id="name" 
                        placeholder="e.g. DND Coffee Senopati" 
                        value={form.name}
                        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="radius">Radius (Meters)</Label>
                      <Input 
                        id="radius" 
                        type="number"
                        min="50"
                        max="1000"
                        placeholder="100" 
                        value={form.radius_meters}
                        onChange={e => setForm(prev => ({ ...prev, radius_meters: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="latitude">Latitude</Label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={getCurrentLocation}
                          className="h-6 text-[10px] gap-1 px-2"
                        >
                          <LocateFixed className="w-3 h-3" />
                          Capture Current
                        </Button>
                      </div>
                      <Input 
                        id="latitude" 
                        placeholder="-6.123456" 
                        value={form.latitude}
                        onChange={e => setForm(prev => ({ ...prev, latitude: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input 
                        id="longitude" 
                        placeholder="106.123456" 
                        value={form.longitude}
                        onChange={e => setForm(prev => ({ ...prev, longitude: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="image_url">Outlet Image URL</Label>
                      <Input 
                        id="image_url" 
                        placeholder="https://images.unsplash.com/photo-..." 
                        value={form.image_url}
                        onChange={e => setForm(prev => ({ ...prev, image_url: e.target.value }))}
                      />
                      <p className="text-[10px] text-muted-foreground">Provide a high-quality image URL for the outlet cover.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-2">
                    <Button type="submit" className="gap-2" disabled={isLoading}>
                      <Save className="w-4 h-4" />
                      {editingId ? "Update Outlet" : "Save Outlet"}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleResetForm} className="gap-2">
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {outlets.length === 0 ? (
              <div className="col-span-full border-2 border-dashed border-muted rounded-xl p-12 flex flex-col items-center justify-center text-muted-foreground">
                <MapPin className="w-12 h-12 mb-4 opacity-20" />
                <p>No outlets configured yet.</p>
                <Button variant="link" onClick={() => setIsAdding(true)}>Create your first outlet</Button>
              </div>
            ) : (
              outlets.map((outlet) => (
                <Card key={outlet.id} className="group overflow-hidden hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md border-border/50">
                  <div className="relative h-32 w-full bg-muted overflow-hidden">
                    {outlet.image_url ? (
                      <img 
                        src={outlet.image_url} 
                        alt={outlet.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                        <MapPin className="w-8 h-8 text-muted-foreground/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                    <Badge 
                      variant={outlet.is_active ? "default" : "secondary"}
                      className="absolute top-3 right-3 shadow-sm"
                    >
                      {outlet.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardHeader className="pb-2 pt-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold">{outlet.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 text-[10px]">
                          <Navigation className="w-2.5 h-2.5" /> 
                          Radius: {outlet.radius_meters}m
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5 mb-2 mt-2">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground font-medium uppercase tracking-wider">Coordinates</span>
                        <span className="font-mono">{outlet.latitude.toFixed(4)}, {outlet.longitude.toFixed(4)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full h-8 gap-2 text-xs font-medium border-border/50 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300"
                        onClick={() => handleEdit(outlet)}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        Configure Location
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            ))}
          </div>
        </TabsContent>

        <TabsContent value="security" className="animate-in slide-in-from-right-4 duration-500">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2 text-primary">
                    <ShieldCheck className="w-6 h-6" />
                    Barista Hardware Security
                  </CardTitle>
                  <CardDescription>
                    Lock baristas to specific devices to prevent attendance fraud.
                  </CardDescription>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter employee..."
                    className="pl-9 rounded-full bg-muted/30 border-none h-9 text-xs"
                    value={searchEmployeeQuery}
                    onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 md:px-6">
              <div className="rounded-lg border border-border overflow-hidden bg-background shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Last Active Device</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees
                      .filter(emp => emp.name.toLowerCase().includes(searchEmployeeQuery.toLowerCase()) || emp.nickname?.toLowerCase().includes(searchEmployeeQuery.toLowerCase()))
                      .map((emp) => (
                        <TableRow key={emp.id} className="hover:bg-muted/10">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                {emp.nickname?.charAt(0) || emp.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-medium text-sm">{emp.name}</div>
                                <div className="text-[10px] text-muted-foreground">{emp.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {emp.registered_device ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-none flex items-center gap-1 w-fit">
                                <Lock className="w-3 h-3" /> Locked
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-muted text-muted-foreground border-none flex items-center gap-1 w-fit">
                                <Unlock className="w-3 h-3" /> Unlocked
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[150px] inline-block">
                              {emp.last_device_id || "No history"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {emp.registered_device ? (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 text-[10px] hover:bg-amber-50 hover:text-amber-600"
                                onClick={() => handleUnlockDevice(emp.id)}
                                disabled={isUpdatingEmployee === emp.id}
                              >
                                <RefreshCcw className={cn("w-3 h-3 mr-1", isUpdatingEmployee === emp.id && "animate-spin")} />
                                Unlock Access
                              </Button>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 text-[10px] hover:bg-emerald-50 hover:text-emerald-600"
                                onClick={() => handleLockDevice(emp.id, emp.last_device_id || null)}
                                disabled={!emp.last_device_id || isUpdatingEmployee === emp.id}
                              >
                                <ShieldCheck className={cn("w-3 h-3 mr-1", isUpdatingEmployee === emp.id && "animate-spin")} />
                                Lock Access
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-start gap-4">
        <div className="p-2 rounded-full bg-primary/10 mt-1">
          <AlertCircle className="w-5 h-5 text-primary" />
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-primary">Security Overview</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Attendance is validated using both Geofencing (Outlet radius) and Hardware Fingerprinting. 
            Use the <strong>Hardware Security</strong> tab to manage specific device restrictions for employees.
          </p>
        </div>
      </div>
    </div>
  )
}
