"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { IdleScreen } from "@/components/ops/idle-screen"
import { OpsMenu } from "@/components/ops/ops-menu"
import { getCurrentUser, getOpsSession } from "@/lib/api/supabase-service"
import { Spinner } from "@/components/ui/spinner"

export default function OpsPage() {
  const [isIdle, setIsIdle] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check if user is authorized to access ops page
    // Either logged in via email OR has NFC session
    const checkAuthorization = () => {
      const user = getCurrentUser()
      const opsSession = getOpsSession()
      
      if (user || opsSession) {
        setIsAuthorized(true)
      } else {
        // Not authorized - redirect to login
        router.push("/login")
      }
      setIsLoading(false)
    }

    checkAuthorization()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return (
    <>
      {isIdle ? (
        <IdleScreen onTap={() => setIsIdle(false)} />
      ) : (
        <OpsMenu onIdle={() => setIsIdle(true)} idleTimeout={30} />
      )}
    </>
  )
}
