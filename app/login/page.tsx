"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { getEmployeeByNFC, getActiveEmployees, type Employee } from "@/lib/api/supabase-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Coffee, AlertCircle, Nfc, Mail, Wifi, Eye, EyeOff } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("email")
  
  // NFC State
  const [nfcInput, setNfcInput] = useState("")
  const [nfcStatus, setNfcStatus] = useState<"waiting" | "success" | "error">("waiting")
  const [nfcMessage, setNfcMessage] = useState("")
  const [activeEmployeesWithNFC, setActiveEmployeesWithNFC] = useState<Employee[]>([])
  const [isProcessingNFC, setIsProcessingNFC] = useState(false)
  const nfcInputRef = useRef<HTMLInputElement>(null)
  const nfcTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const { login } = useAuth()
  const router = useRouter()

  // Load active employees with NFC for demo hints
  useEffect(() => {
    const loadEmployees = async () => {
      const employees = await getActiveEmployees()
      setActiveEmployeesWithNFC(employees.filter(emp => emp.nfc_uid))
    }
    loadEmployees()
  }, [])

  // Focus NFC input when tab changes and keep it focused
  useEffect(() => {
    if (activeTab === "nfc") {
      nfcInputRef.current?.focus()
      
      // Keep focus on NFC input - refocus if lost
      const handleFocusLoss = () => {
        if (activeTab === "nfc" && nfcStatus === "waiting") {
          setTimeout(() => nfcInputRef.current?.focus(), 100)
        }
      }
      
      document.addEventListener("click", handleFocusLoss)
      return () => document.removeEventListener("click", handleFocusLoss)
    }
  }, [activeTab, nfcStatus])

  // Process NFC lookup
  const processNFCLookup = useCallback(async (uid: string) => {
    if (isProcessingNFC) return
    setIsProcessingNFC(true)
    
    // Clean the UID: trim whitespace, remove line breaks, convert to lowercase
    const cleanUID = uid.trim().replace(/[\r\n]/g, '').toLowerCase()
    
    // Look for employee with this NFC in Supabase
    const employee = await getEmployeeByNFC(cleanUID)
    
    if (employee) {
      setNfcStatus("success")
      setNfcMessage(`Welcome, ${employee.nickname}!`)
      
      // Store NFC session info for ops access
      localStorage.setItem("dnd_ops_session", JSON.stringify({
        employeeId: employee.id,
        employeeName: employee.nickname,
        authenticatedAt: new Date().toISOString(),
        authMethod: "nfc"
      }))
      
      setTimeout(() => {
        router.push("/ops")
      }, 1500)
    } else {
      setNfcStatus("error")
      setNfcMessage("NFC card not registered")
      setTimeout(() => {
        setNfcStatus("waiting")
        setNfcMessage("")
        setNfcInput("")
        setIsProcessingNFC(false)
        nfcInputRef.current?.focus()
      }, 2000)
    }
  }, [isProcessingNFC, router])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const result = await login(email, password)
    
    if (result.success) {
      // ALL users go to employee dashboard first
      // Admin/super_admin users can access /admin via "View Dashboard" button
      router.push("/employee")
    } else {
      setError(result.error || "Login failed")
    }
    
    setIsLoading(false)
  }

  const handleNFCInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setNfcInput(value)
    
    // Clear existing timeout
    if (nfcTimeoutRef.current) {
      clearTimeout(nfcTimeoutRef.current)
    }
    
    // If input is long enough, set a short timeout to auto-trigger lookup
    // NFC readers typically input all characters quickly, so 150ms delay is enough
    if (value.length >= 4) {
      nfcTimeoutRef.current = setTimeout(() => {
        processNFCLookup(value)
      }, 150)
    }
  }

  const handleNFCKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Also trigger on Enter key
    if (e.key === "Enter" && nfcInput.length >= 4) {
      e.preventDefault()
      if (nfcTimeoutRef.current) {
        clearTimeout(nfcTimeoutRef.current)
      }
      processNFCLookup(nfcInput)
    }
  }

  const handleNFCButtonClick = async (nfcUid: string) => {
    setNfcInput(nfcUid)
    await processNFCLookup(nfcUid)
  }

  return (
    <div className="min-h-screen bg-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-background/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Coffee className="w-8 h-8 text-background" />
          </div>
          <h1 className="text-2xl font-light tracking-widest text-background">
            DONOTDISTURB
          </h1>
          <p className="text-background/50 text-sm mt-2">Management System</p>
        </div>

        <Card className="bg-background border-0 rounded-sm">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-medium">Sign In</CardTitle>
            <CardDescription>
              Choose your login method
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="nfc" className="flex items-center gap-2">
                  <Nfc className="h-4 w-4" />
                  NFC Card
                </TabsTrigger>
              </TabsList>
              
              {/* Email Login Tab */}
              <TabsContent value="email" className="mt-0">
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive" className="rounded-sm">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="text"
                      placeholder="Enter email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rounded-sm"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="rounded-sm pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full rounded-sm bg-foreground text-background hover:bg-foreground/90"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>

                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center mb-4">
                    Login using employee credentials from the database
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    Email login grants access to Admin or Employee dashboards based on role
                  </p>
                </div>
              </TabsContent>

              {/* NFC Login Tab */}
              <TabsContent value="nfc" className="mt-0">
                <div className="flex flex-col items-center py-8">
                  <div className={`
                    w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all duration-300
                    ${nfcStatus === "waiting" ? "bg-muted animate-pulse" : ""}
                    ${nfcStatus === "success" ? "bg-green-100 dark:bg-green-900/30" : ""}
                    ${nfcStatus === "error" ? "bg-red-100 dark:bg-red-900/30" : ""}
                  `}>
                    {nfcStatus === "waiting" && (
                      <Wifi className="w-10 h-10 text-muted-foreground" />
                    )}
                    {nfcStatus === "success" && (
                      <Nfc className="w-10 h-10 text-green-600 dark:text-green-400" />
                    )}
                    {nfcStatus === "error" && (
                      <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  
                  <p className={`text-center font-medium mb-2 ${
                    nfcStatus === "success" ? "text-green-600 dark:text-green-400" : 
                    nfcStatus === "error" ? "text-red-600 dark:text-red-400" : 
                    "text-foreground"
                  }`}>
                    {nfcStatus === "waiting" && "Tap your NFC card"}
                    {nfcStatus === "success" && nfcMessage}
                    {nfcStatus === "error" && nfcMessage}
                  </p>
                  
                  <p className="text-sm text-muted-foreground text-center">
                    {nfcStatus === "waiting" && "Hold your employee card near the reader to access operations"}
                    {nfcStatus === "success" && "Redirecting to operations..."}
                    {nfcStatus === "error" && ""}
                  </p>
                  
                  {/* Hidden input for NFC reader - always focused */}
                  <Input
                    ref={nfcInputRef}
                    type="text"
                    value={nfcInput}
                    onChange={handleNFCInput}
                    onKeyDown={handleNFCKeyDown}
                    className="opacity-0 absolute -z-10"
                    autoFocus={activeTab === "nfc"}
                    disabled={isProcessingNFC || nfcStatus !== "waiting"}
                  />

                  <p className="text-xs text-muted-foreground mt-6 text-center">
                    NFC login grants access to the operational interface only
                  </p>
                </div>

                {/* Demo NFC UIDs */}
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center mb-3">
                    Demo NFC UIDs (click to test)
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {activeEmployeesWithNFC.map((emp) => (
                      <Button 
                        key={emp.id}
                        variant="outline" 
                        size="sm" 
                        className="text-xs font-mono"
                        onClick={() => handleNFCButtonClick(emp.nfc_uid!)}
                      >
                        {emp.nfc_uid} ({emp.nickname})
                      </Button>
                    ))}
                    {activeEmployeesWithNFC.length === 0 && (
                      <p className="text-xs text-muted-foreground">No employees with NFC cards found</p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Link 
            href="/" 
            className="text-sm text-background/50 hover:text-background transition-colors"
          >
            Back to website
          </Link>
        </div>
      </div>
    </div>
  )
}
