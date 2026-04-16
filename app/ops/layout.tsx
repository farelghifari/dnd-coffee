"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
import { Toaster } from "@/components/ui/sonner"

interface OpsSession {
  employeeId: string
  employeeName: string
  authenticatedAt: string
  authMethod: "nfc"
}

export default function OpsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [session, setSession] = useState<OpsSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check for NFC session specifically
    const storedSession = localStorage.getItem("dnd_ops_session")
    
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession) as OpsSession
        // Validate it's an NFC session
        if (parsed.authMethod === "nfc" && parsed.employeeId) {
          setSession(parsed)
        } else {
          // Invalid session, redirect to login
          localStorage.removeItem("dnd_ops_session")
          router.push("/login")
        }
      } catch {
        localStorage.removeItem("dnd_ops_session")
        router.push("/login")
      }
    } else {
      // No session, redirect to login
      router.push("/login")
    }
    
    setIsLoading(false)
  }, [router])

  if (isLoading) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {children}
      <Toaster />
    </div>
  )
}
