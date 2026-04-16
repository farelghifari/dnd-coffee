"use client"

import { useEffect, useState } from "react"
import { Coffee } from "lucide-react"

interface IdleScreenProps {
  onTap: () => void
}

export function IdleScreen({ onTap }: IdleScreenProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div
      className="fixed inset-0 bg-background flex flex-col items-center justify-center cursor-pointer select-none"
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onTap()
        }
      }}
      aria-label="Tap to start"
    >
      {/* Logo */}
      <div className="mb-16">
        <div className="w-28 h-28 rounded-sm bg-foreground/10 flex items-center justify-center mb-8 mx-auto">
          <Coffee className="w-14 h-14 text-foreground" />
        </div>
        <h1 className="text-4xl font-light tracking-[0.3em] text-center">
          DONOTDISTURB
        </h1>
        <p className="text-sm text-muted-foreground text-center mt-2 tracking-widest">
          OPERATIONS
        </p>
      </div>

      {/* Clock */}
      <div className="text-center mb-20">
        <div className="text-[8rem] md:text-[10rem] font-extralight tracking-tight font-mono tabular-nums leading-none">
          {formatTime(currentTime)}
        </div>
        <div className="text-xl text-muted-foreground mt-6">
          {formatDate(currentTime)}
        </div>
      </div>

      {/* Tap instruction */}
      <div className="animate-pulse">
        <p className="text-lg text-muted-foreground tracking-[0.2em]">
          TAP TO START
        </p>
      </div>

      {/* Subtle decoration */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
        <div className="w-20 h-0.5 bg-foreground/20 rounded-full" />
      </div>
    </div>
  )
}
