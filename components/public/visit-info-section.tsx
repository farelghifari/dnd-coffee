"use client"

import { shopInfo } from "@/lib/data"
import { MapPin, Clock, Mail } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useScrollAnimation } from "@/hooks/use-scroll-animation"
import { cn } from "@/lib/utils"

export function VisitInfoSection() {
  const { ref: contentRef, isInView: contentInView } = useScrollAnimation()
  const { ref: infoRef, isInView: infoInView } = useScrollAnimation()

  return (
    <section className="pt-24 md:pt-32 pb-12 px-6 bg-[#000000] text-[#F9F4EB]" style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div
            ref={contentRef}
            className={cn(
              "transition-all duration-700",
              contentInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
          >
            <p className="text-xs uppercase tracking-[0.3em] opacity-50 mb-4 text-[#DC6835]">
              Find Us
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight mb-8">
              Visit DONOTDISTURB
            </h2>
            <p className="opacity-60 leading-relaxed mb-10 max-w-md text-lg">
              Step into our space and discover where specialty coffee meets 
              thoughtful design. We look forward to serving you.
            </p>
            <Button 
              asChild 
              size="lg" 
              className="bg-[#DC6835] text-white hover:bg-[#DC6835]/90 rounded-xl"
            >
              <Link href="/visit">
                Get Directions
              </Link>
            </Button>
          </div>

          <div 
            ref={infoRef}
            className={cn(
              "space-y-8 transition-all duration-700 delay-200",
              infoInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
          >
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-background/10 rounded-full flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold mb-2 text-xl">Location</h3>
                <p className="opacity-70 text-lg uppercase">{shopInfo.address}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-background/10 rounded-full flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium mb-2">Opening Hours</h3>
                <div className="text-background/60 space-y-1">
                  <p>Monday - Friday: {shopInfo.hours.weekday}</p>
                  <p>Saturday - Sunday: {shopInfo.hours.weekend}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-background/10 rounded-full flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium mb-2">Contact</h3>
                <div className="text-background/60 space-y-1">
                  <p>{shopInfo.phone}</p>
                  <p>{shopInfo.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
