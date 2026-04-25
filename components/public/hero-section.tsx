"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, MapPin, Coffee, Laptop, BookOpen, Clock } from "lucide-react"
import { motion } from "framer-motion"

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden bg-[#F9F4EB] text-[#2A1B14] font-sans min-h-[95vh] flex flex-col justify-center items-center pt-20">
      
      {/* Background Animated Coffee Pattern - Immersive and Generic */}
      <motion.div 
        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
        transition={{ rotate: { repeat: Infinity, duration: 180, ease: "linear" }, scale: { repeat: Infinity, duration: 20, ease: "easeInOut", type: "tween" } }}
        className="absolute inset-0 z-0 flex items-center justify-center opacity-5 pointer-events-none"
      >
        <div className="grid grid-cols-6 gap-32 transform scale-125">
           {Array(36).fill(0).map((_, i) => (
             <div key={i} className="text-[#2A1B14] rotate-12">
                <Coffee size={120} strokeWidth={0.5} />
             </div>
           ))}
        </div>
      </motion.div>

      {/* Floating Story Elements (Fulfilling the Line Art Animations without reusing the same mascot) */}
      <motion.div drag dragMomentum={true} whileHover={{ scale: 1.2 }} animate={{ y: [0, -20, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }} className="absolute top-[20%] left-[10%] z-20 text-[#DC6835] bg-[#F9F4EB] p-4 rounded-full border-2 border-[#DC6835]/30 shadow-xl cursor-grab">
        <Coffee size={40} />
      </motion.div>

      <motion.div drag dragMomentum={true} whileHover={{ scale: 1.2 }} animate={{ y: [0, 25, 0] }} transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }} className="absolute top-[30%] right-[15%] z-20 text-[#1B3629] bg-[#F9F4EB] p-4 rounded-3xl border-2 border-[#1B3629]/20 shadow-2xl cursor-grab rotate-12">
        <Laptop size={48} />
      </motion.div>

      <motion.div drag dragMomentum={true} whileHover={{ scale: 1.2 }} animate={{ y: [0, -15, 0], rotate: [-10, 0, -10] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut", delay: 2 }} className="absolute bottom-[20%] left-[15%] z-20 text-[#DC6835] bg-transparent cursor-grab">
        <Clock size={60} strokeWidth={1.5} />
      </motion.div>

      <motion.div drag dragMomentum={true} whileHover={{ scale: 1.2 }} animate={{ y: [0, 15, 0] }} transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut", delay: 0.5 }} className="absolute bottom-[25%] right-[20%] z-20 text-[#1B3629] bg-[#F9F4EB] p-4 rounded-full shadow-lg border border-[#1B3629]/10 cursor-grab -rotate-12">
        <BookOpen size={32} />
      </motion.div>

      <div className="container mx-auto px-6 relative z-10 w-full h-full text-center flex flex-col items-center pb-32 md:pb-40">
        
        {/* Typographic Centerpiece */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1B3629] text-[#F9F4EB] font-bold text-sm tracking-widest shadow-2xl mb-12 border-2 border-[#DC6835]/30"
        >
          <MapPin size={16} className="text-[#DC6835]" />
          <span>EST. KOTA SEMARANG</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="text-[4rem] sm:text-[6rem] md:text-[8rem] lg:text-[10rem] font-black tracking-tighter leading-[0.8] mb-8 text-[#2A1B14] drop-shadow-sm"
        >
          Do Not <br className="hidden md:block"/>
          <span className="text-[#DC6835] italic font-sans">Disturb</span>
        </motion.h1>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="relative max-w-3xl mx-auto mb-16 px-4"
        >
           <div className="absolute -left-6 top-0 text-[#DC6835] text-6xl font-sans opacity-40">"</div>
           <p className="text-2xl md:text-3xl lg:text-4xl font-medium text-[#2A1B14] leading-tight" style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}>
             From the first morning grind to your midnight eureka moment. Find your sanctuary amidst the pulse of the city.
           </p>
           <div className="absolute -right-2 bottom-0 text-[#DC6835] text-6xl font-sans opacity-40">"</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-6 justify-center items-center mt-4"
        >
          <Button asChild size="lg" className="bg-[#DC6835] text-white hover:bg-[#2A1B14] hover:scale-105 hover:-translate-y-1 transition-all duration-300 rounded-full px-12 py-8 text-xl font-bold shadow-[0_15px_35px_rgba(220,104,53,0.3)]">
            <Link href="/visit">Drop By <ArrowRight className="ml-3 h-6 w-6" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="bg-[#F9F4EB] border-[3px] border-[#2A1B14] text-[#2A1B14] hover:bg-[#2A1B14] hover:text-[#F9F4EB] hover:scale-105 hover:-translate-y-1 transition-all duration-300 rounded-full px-12 py-8 text-xl font-bold shadow-xl">
            <Link href="/activity">Explore Menu</Link>
          </Button>
        </motion.div>
      </div>

      {/* Marquee Bawah */}
      <div className="absolute bottom-4 left-0 w-full bg-[#1B3629] text-[#F9F4EB] py-5 overflow-hidden flex whitespace-nowrap z-20 transform rotate-1 scale-105 origin-center shadow-2xl">
        <motion.div 
          animate={{ x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
          className="flex gap-10 text-2xl font-black tracking-widest uppercase items-center"
        >
          {Array(8).fill("DND Coffee • 24/7 Creator Space").map((text, i) => (
            <span key={i} className="flex-shrink-0">{text}</span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
