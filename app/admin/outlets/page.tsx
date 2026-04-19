"use client"

import { useState, useEffect } from "react"
import { 
  getOutlets, 
  addOutlet, 
  updateOutlet, 
  type Outlet 
} from "@/lib/api/supabase-service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  MapPin, 
  Navigation, 
  Settings2, 
  Save, 
  X, 
  CheckCircle2, 
  AlertCircle,
  LocateFixed
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function OutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Form state
  const [form, setForm] = useState({
    name: "",
    latitude: "",
    longitude: "",
    radius_meters: "100",
    is_active: true
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    const data = await getOutlets()
    setOutlets(data)
    setIsLoading(false)
  }

  const handleResetForm = () => {
    setForm({
      name: "",
      latitude: "",
      longitude: "",
      radius_meters: "100",
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
          <h1 className="text-3xl font-bold tracking-tight">Outlet Management</h1>
          <p className="text-muted-foreground">Define valid locations and geofencing radius for attendance.</p>
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add New Outlet
          </Button>
        )}
      </header>

      {isAdding && (
        <Card className="border-primary/20 shadow-md animate-in slide-in-from-top-4 duration-300">
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
              </div>
              
              <div className="flex items-center gap-2 pt-2">
                <Button type="submit" className="gap-2">
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
            <Card key={outlet.id} className="group hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{outlet.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Navigation className="w-3 h-3" /> 
                        Radius: {outlet.radius_meters}m
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={outlet.is_active ? "default" : "secondary"}>
                    {outlet.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 rounded-lg p-3 space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-medium uppercase tracking-wider">Latitude</span>
                    <span className="font-mono">{outlet.latitude}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-medium uppercase tracking-wider">Longitude</span>
                    <span className="font-mono">{outlet.longitude}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full gap-2 text-primary hover:text-primary hover:bg-primary/5 border-primary/20"
                    onClick={() => handleEdit(outlet)}
                  >
                    <Settings2 className="w-4 h-4" />
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-start gap-4">
        <div className="p-2 rounded-full bg-primary/10 mt-1">
          <AlertCircle className="w-5 h-5 text-primary" />
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-primary">Geofencing Active</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Attendance via personal mobile devices is automatically validated against these coordinates. 
            If an employee attempts to clock in or out further than the specified radius, their request will be automatically rejected.
          </p>
        </div>
      </div>
    </div>
  )
}
