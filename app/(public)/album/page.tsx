"use client"

import { useState } from "react"
import { galleryImages } from "@/lib/data"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const categories = ["all", "interior", "coffee", "people", "events"] as const

export default function AlbumPage() {
  const [selectedCategory, setSelectedCategory] = useState<typeof categories[number]>("all")
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const filteredImages = selectedCategory === "all" 
    ? galleryImages 
    : galleryImages.filter(img => img.category === selectedCategory)

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    document.body.style.overflow = "hidden"
  }

  const closeLightbox = () => {
    setLightboxIndex(null)
    document.body.style.overflow = "auto"
  }

  const nextImage = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % filteredImages.length)
    }
  }

  const prevImage = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex - 1 + filteredImages.length) % filteredImages.length)
    }
  }

  return (
    <div className="py-24 md:py-32">
      {/* Header */}
      <section className="px-6 mb-16">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Gallery
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6">
            Album
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Moments captured in our space. A visual journey through coffee, 
            community, and creativity.
          </p>
        </div>
      </section>

      {/* Category Filter */}
      <section className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-6 py-2 rounded-full text-sm capitalize transition-colors",
                  selectedCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Photo Grid - Masonry-like */}
      <section className="px-6">
        <div className="max-w-7xl mx-auto">
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
            {filteredImages.map((image, index) => (
              <div 
                key={image.id}
                className="break-inside-avoid mb-4 cursor-pointer group"
                onClick={() => openLightbox(index)}
              >
                <div 
                  className={cn(
                    "bg-muted rounded-lg overflow-hidden relative",
                    index % 3 === 0 ? "aspect-[4/5]" : index % 3 === 1 ? "aspect-square" : "aspect-[4/3]"
                  )}
                  style={{
                    backgroundImage: `url('${image.src}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-background text-sm font-medium">
                      View
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div 
          className="fixed inset-0 z-50 bg-foreground/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button 
            className="absolute top-6 right-6 text-background/70 hover:text-background transition-colors"
            onClick={closeLightbox}
            aria-label="Close lightbox"
          >
            <X className="h-8 w-8" />
          </button>

          {/* Navigation */}
          <button 
            className="absolute left-6 text-background/70 hover:text-background transition-colors"
            onClick={(e) => { e.stopPropagation(); prevImage(); }}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-10 w-10" />
          </button>

          <button 
            className="absolute right-6 text-background/70 hover:text-background transition-colors"
            onClick={(e) => { e.stopPropagation(); nextImage(); }}
            aria-label="Next image"
          >
            <ChevronRight className="h-10 w-10" />
          </button>

          {/* Image */}
          <div 
            className="max-w-[90vw] max-h-[90vh] aspect-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="w-full h-full min-w-[60vw] min-h-[60vh] bg-contain bg-center bg-no-repeat"
              style={{
                backgroundImage: `url('${filteredImages[lightboxIndex].src}')`,
              }}
            />
            <p className="text-center text-background/70 mt-4 text-sm">
              {filteredImages[lightboxIndex].alt}
            </p>
          </div>

          {/* Counter */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-background/70 text-sm">
            {lightboxIndex + 1} / {filteredImages.length}
          </div>
        </div>
      )}
    </div>
  )
}
