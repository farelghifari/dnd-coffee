"use client"

import { useState } from "react"
import { galleryImages, shopInfo } from "@/lib/data"
import { X, ChevronLeft, ChevronRight, Image as ImageIcon, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

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
    <div className="min-h-screen bg-[#000000] text-[#F9F4EB] py-32 md:py-48 px-6 relative overflow-hidden" style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}>
      
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#DC6835] rounded-full blur-[300px] opacity-[0.03] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#2A1B14] rounded-full blur-[250px] opacity-[0.05] pointer-events-none" />

      {/* Header */}
      <section className="mb-24 relative z-10">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-[#DC6835]/30 text-[#DC6835] font-bold text-xs tracking-[0.3em] uppercase mb-10 w-fit mx-auto"
          >
             <ImageIcon size={16} />
             <span>MOMENTS CAPTURED</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-10 leading-none"
          >
            THE ALBUM
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-[#F9F4EB]/40 max-w-2xl mx-auto leading-relaxed text-xl italic"
          >
            A visual curation of our specialized coffee culture, quiet corners, and the restless ideas that bubble within {shopInfo.name}.
          </motion.p>
        </div>
      </section>

      {/* Category Filter */}
      <section className="mb-16 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-6">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-8 py-3 rounded-2xl text-lg capitalize transition-all border border-white/5",
                  selectedCategory === category
                    ? "bg-[#DC6835] text-white border-[#DC6835] shadow-[0_10px_20px_rgba(220,104,53,0.2)]"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Photo Grid */}
      <section className="relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredImages.map((image, index) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={image.id}
                  className="relative cursor-pointer group"
                  onClick={() => openLightbox(index)}
                >
                  <div className="aspect-[4/5] overflow-hidden rounded-[2.5rem] bg-[#111] border border-white/10 transition-all group-hover:border-[#DC6835]/40 group-hover:scale-[1.02]">
                    <img 
                      src={image.src} 
                      alt={image.alt}
                      className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-8">
                       <div className="flex items-center gap-3">
                         <div className="p-3 rounded-full bg-[#DC6835] text-white shadow-lg">
                           <Sparkles size={16} />
                         </div>
                         <span className="font-bold text-sm uppercase tracking-widest">{image.category}</span>
                       </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-2xl flex items-center justify-center p-6"
            onClick={closeLightbox}
          >
            {/* Close button */}
            <button 
              className="absolute top-10 right-10 w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
              onClick={closeLightbox}
            >
              <X className="h-6 w-6" />
            </button>

            {/* Navigation */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-6 pointer-events-none">
              <button 
                className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors pointer-events-auto"
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
              >
                <ChevronLeft className="h-8 w-8" />
              </button>

              <button 
                className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors pointer-events-auto"
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            </div>

            {/* Content */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-6xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-[4rem] overflow-hidden border border-white/10 shadow-3xl">
                <img 
                  src={filteredImages[lightboxIndex].src} 
                  alt={filteredImages[lightboxIndex].alt}
                  className="w-full h-auto max-h-[80vh] object-contain"
                />
              </div>
              <p className="text-center text-4xl font-bold mt-10">
                {filteredImages[lightboxIndex].alt}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
