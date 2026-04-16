"use client"

import Link from "next/link"
import { communityEvents } from "@/lib/data"
import { ArrowRight, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useScrollAnimation } from "@/hooks/use-scroll-animation"
import { cn } from "@/lib/utils"

export function CommunityHighlightsSection() {
  const { ref: headerRef, isInView: headerInView } = useScrollAnimation()
  const { ref: cardsRef, isInView: cardsInView } = useScrollAnimation()

  return (
    <section className="py-24 md:py-32 px-6 bg-background">
      <div className="max-w-7xl mx-auto">
        <div 
          ref={headerRef}
          className={cn(
            "text-center mb-16 transition-all duration-700",
            headerInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">
            Join Us
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight mb-6">
            Our Community
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            More than just coffee lovers, we are a collective of curious minds sharing 
            knowledge, experiences, and the perfect cup.
          </p>
        </div>

        <div 
          ref={cardsRef}
          className={cn(
            "grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-700 delay-200",
            cardsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          {communityEvents.map((event, index) => (
            <div 
              key={event.id}
              className={cn(
                "group relative p-8 bg-secondary rounded-sm border border-border hover:border-foreground/20 transition-all duration-500",
                cardsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              )}
              style={{ transitionDelay: `${(index + 1) * 100}ms` }}
            >
              <div className="w-12 h-12 bg-foreground/5 rounded-full flex items-center justify-center mb-6">
                <Users className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-medium mb-3">
                {event.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {event.description}
              </p>
              <p className="text-sm font-medium text-foreground">
                {event.schedule}
              </p>
            </div>
          ))}
        </div>

        <div 
          className={cn(
            "text-center mt-12 transition-all duration-700 delay-400",
            cardsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <Button 
            asChild 
            size="lg"
            className="bg-foreground text-background hover:bg-foreground/90 rounded-none px-8"
          >
            <Link href="/community" className="group">
              Explore Community
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
