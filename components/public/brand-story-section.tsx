"use client"

import { useScrollAnimation } from "@/hooks/use-scroll-animation"
import { cn } from "@/lib/utils"

export function BrandStorySection() {
  const { ref: headerRef, isInView: headerInView } = useScrollAnimation()
  const { ref: contentRef, isInView: contentInView } = useScrollAnimation()
  const { ref: imagesRef, isInView: imagesInView } = useScrollAnimation()

  return (
    <section className="py-24 md:py-32 px-6 bg-secondary">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div
              ref={headerRef}
              className={cn(
                "transition-all duration-700",
                headerInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              )}
            >
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">
                Our Story
              </p>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight mb-8 text-balance">
                A space for focus, fueled by exceptional coffee
              </h2>
            </div>
            <div
              ref={contentRef}
              className={cn(
                "space-y-6 text-muted-foreground leading-relaxed transition-all duration-700 delay-200",
                contentInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              )}
            >
              <p>
                DONOTDISTURB was born from a simple belief: great work deserves great coffee. 
                We created a sanctuary where creative minds can find their flow state, 
                supported by meticulously sourced and crafted specialty coffee.
              </p>
              <p>
                Our beans travel from the highlands of Flores, the forests of Ethiopia, 
                and the mountains of Colombia directly to your cup. Each origin selected 
                for its unique character, each roast profile developed to honor the farmer&apos;s craft.
              </p>
              <p>
                More than a coffee shop, we are a community of makers, thinkers, and creators 
                who understand that sometimes the best conversations happen in comfortable silence.
              </p>
            </div>
          </div>

          <div
            ref={imagesRef}
            className={cn(
              "grid grid-cols-2 gap-4 transition-all duration-700 delay-300",
              imagesInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
          >
            <div className="space-y-4">
              <div 
                className="aspect-[3/4] bg-muted rounded-sm overflow-hidden"
                style={{
                  backgroundImage: "url('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div 
                className="aspect-square bg-muted rounded-sm overflow-hidden"
                style={{
                  backgroundImage: "url('https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=600&q=80')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            </div>
            <div className="pt-8 space-y-4">
              <div 
                className="aspect-square bg-muted rounded-sm overflow-hidden"
                style={{
                  backgroundImage: "url('https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&q=80')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div 
                className="aspect-[3/4] bg-muted rounded-sm overflow-hidden"
                style={{
                  backgroundImage: "url('https://images.unsplash.com/photo-1511920170033-f8396924c348?w=600&q=80')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
