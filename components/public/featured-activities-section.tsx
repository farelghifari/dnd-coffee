"use client"

import Link from "next/link"
import { activities } from "@/lib/data"
import { ArrowRight, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useScrollAnimation } from "@/hooks/use-scroll-animation"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

const activityBackgrounds = [
  "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=1920&q=80",
  "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=1920&q=80",
  "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=1920&q=80",
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1920&q=80",
]

export function FeaturedActivitiesSection() {
  const featuredActivities = activities.slice(0, 3)
  const { ref: headerRef, isInView: headerInView } = useScrollAnimation()
  const { ref: cardsRef, isInView: cardsInView } = useScrollAnimation()
  const [currentBg, setCurrentBg] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBg((prev) => (prev + 1) % activityBackgrounds.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative py-24 md:py-32 px-6 overflow-hidden">
      {/* Background Image Slider */}
      {activityBackgrounds.map((bg, index) => (
        <div
          key={index}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1500 ease-in-out"
          style={{
            backgroundImage: `url('${bg}')`,
            opacity: currentBg === index ? 1 : 0,
          }}
        />
      ))}
      
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-foreground/85" />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        <div 
          ref={headerRef}
          className={cn(
            "flex flex-col md:flex-row md:items-end md:justify-between mb-16 transition-all duration-700",
            headerInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-background/60 mb-4">
              Upcoming
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight text-background">
              Activities & Events
            </h2>
          </div>
          {/* Fixed: Black background, white text button with proper visibility */}
          <Button 
            asChild 
            className="mt-6 md:mt-0 w-fit bg-background text-foreground hover:bg-background/90 rounded-none px-6"
          >
            <Link href="/activity" className="group flex items-center">
              View all activities
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>

        <div 
          ref={cardsRef}
          className={cn(
            "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-700 delay-200",
            cardsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          {featuredActivities.map((activity, index) => (
            <article 
              key={activity.id}
              className={cn(
                "group bg-background rounded-sm overflow-hidden border border-border hover:shadow-xl transition-all duration-500",
                cardsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              )}
              style={{ transitionDelay: `${(index + 1) * 100}ms` }}
            >
              <div 
                className="aspect-[4/3] bg-muted relative overflow-hidden"
                style={{
                  backgroundImage: `url('https://images.unsplash.com/photo-${
                    index === 0 ? '1495474472287-4d71bcdd2085' : 
                    index === 1 ? '1442512595331-e89e73853f31' : 
                    '1514432324607-a09d9b4aefdd'
                  }?w=800&q=80')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors" />
                <div className="absolute top-4 left-4">
                  <span className="inline-block px-3 py-1 bg-background/95 text-foreground text-xs uppercase tracking-wider rounded-none">
                    {activity.category}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Calendar className="h-4 w-4" />
                  {new Date(activity.date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <h3 className="text-xl font-medium mb-3 group-hover:text-muted-foreground transition-colors">
                  {activity.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {activity.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
