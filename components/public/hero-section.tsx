"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useEffect, useState } from "react"

const heroBackgrounds = [
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1920&q=80",
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1920&q=80",
  "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1920&q=80",
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1920&q=80",
]

export function HeroSection() {
  const [currentBg, setCurrentBg] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBg((prev) => (prev + 1) % heroBackgrounds.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative h-screen min-h-[700px] flex items-center justify-center overflow-hidden">
      {/* Background Image Slider */}
      {heroBackgrounds.map((bg, index) => (
        <div
          key={index}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1500 ease-in-out"
          style={{
            backgroundImage: `url('${bg}')`,
            opacity: currentBg === index ? 1 : 0,
          }}
        />
      ))}
      
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-foreground/70" />

      {/* Content */}
      <div className="relative z-10 text-center text-background px-6 max-w-4xl mx-auto">
        <p className="text-xs uppercase tracking-[0.4em] mb-8 text-background/60 animate-fade-in in-view">
          Specialty Coffee & Creative Space
        </p>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-light tracking-tight mb-8 text-balance">
          Do Not Disturb
        </h1>
        <p className="text-base md:text-lg text-background/70 max-w-xl mx-auto mb-12 leading-relaxed">
          Where every cup tells a story. Single-origin beans, crafted with intention, 
          served in a space designed for focus and creativity.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            asChild 
            size="lg" 
            className="bg-background text-foreground hover:bg-background/90 px-8 rounded-none"
          >
            <Link href="/visit">
              Visit Us
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button 
            asChild 
            size="lg"
            className="bg-foreground text-background border-2 border-background hover:bg-foreground/80 px-8 rounded-none"
          >
            <Link href="/activity">
              Our Activities
            </Link>
          </Button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-5 h-8 border border-background/40 rounded-full flex items-start justify-center p-1.5">
          <div className="w-0.5 h-2 bg-background/60 rounded-full" />
        </div>
      </div>

      {/* Background indicators */}
      <div className="absolute bottom-12 right-8 flex gap-2">
        {heroBackgrounds.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentBg(index)}
            className={cn(
              "w-8 h-0.5 transition-all duration-300",
              currentBg === index ? "bg-background" : "bg-background/30"
            )}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
