"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, MapPin, Coffee, Laptop, BookOpen, Clock } from "lucide-react"
import { motion } from "framer-motion"

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden bg-[#F9F4EB] text-[#2A1B14] font-sans min-h-[95vh] flex flex-col justify-center items-center pt-20">
      
      {/* Background Animated Coffee Pattern - Optimized for performance */}
      <motion.div 
        animate={{ rotate: 360, scale: [1, 1.05, 1] }}
        transition={{ rotate: { repeat: Infinity, duration: 240, ease: "linear" }, scale: { repeat: Infinity, duration: 25, ease: "easeInOut", type: "tween" } }}
        style={{ willChange: "transform" }}
        className="absolute inset-0 z-0 flex items-center justify-center opacity-5 pointer-events-none"
      >
        <div className="grid grid-cols-4 md:grid-cols-6 gap-32 transform scale-125">
           {/* Reduced count slightly for mobile performance */}
           {Array(24).fill(0).map((_, i) => (
             <div key={i} className="text-[#2A1B14] rotate-12">
                <Coffee size={120} strokeWidth={0.5} />
             </div>
           ))}
        </div>
      </motion.div>

      {/* Floating Story Elements - Using once:true for viewport performance */}
      <motion.div 
        drag 
        dragMomentum={true} 
        whileHover={{ scale: 1.1 }} 
        animate={{ y: [0, -20, 0] }} 
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} 
        className="absolute top-[20%] left-[10%] z-20 text-[#DC6835] bg-[#F9F4EB] p-4 rounded-full border-2 border-[#DC6835]/30 shadow-xl cursor-grab hidden sm:flex"
      >
        <Coffee size={40} />
      </motion.div>

      <motion.div 
        drag 
        dragMomentum={true} 
        whileHover={{ scale: 1.1 }} 
        animate={{ y: [0, 25, 0] }} 
        transition={{ repeat: Infinity, duration: 8, ease: "easeInOut", delay: 1 }} 
        className="absolute top-[30%] right-[15%] z-20 text-[#1B3629] bg-[#F9F4EB] p-4 rounded-3xl border-2 border-[#1B3629]/20 shadow-2xl cursor-grab rotate-12 hidden sm:flex"
      >
        <Laptop size={48} />
      </motion.div>

      {/* Center content */}
      <div className="container mx-auto px-6 relative z-10 w-full h-full text-center flex flex-col items-center pb-32 md:pb-40">
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1B3629] text-[#F9F4EB] font-bold text-sm tracking-widest shadow-2xl mb-12 border-2 border-[#DC6835]/30"
        >
          <MapPin size={16} className="text-[#DC6835]" />
          <span>EST. KOTA SEMARANG</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="text-[4rem] sm:text-[6rem] md:text-[8rem] lg:text-[10rem] font-black tracking-tighter leading-[0.8] mb-8 text-[#2A1B14] drop-shadow-sm"
        >
          Do Not <br className="hidden md:block"/>
          <span className="text-[#DC6835] italic font-sans font-normal opacity-90">Disturb</span>
        </motion.h1>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
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
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-6 justify-center items-center mt-4"
        >
          <Button asChild size="lg" className="bg-[#DC6835] text-white hover:bg-[#2A1B14] hover:scale-105 transition-all duration-300 rounded-full px-12 py-8 text-xl font-bold shadow-2xl">
            <Link href="/visit">Drop By <ArrowRight className="ml-3 h-6 w-6" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="bg-[#F9F4EB]/50 backdrop-blur-sm border-[3px] border-[#2A1B14] text-[#2A1B14] hover:bg-[#2A1B14] hover:text-[#F9F4EB] hover:scale-105 transition-all duration-300 rounded-full px-12 py-8 text-xl font-bold">
            <Link href="#menu">Explore Menu</Link>
          </Button>
        </motion.div>
      </div>

      {/* Marquee - Optimized with hardware acceleration */}
      <div className="absolute bottom-4 left-0 w-full bg-[#1B3629] text-[#F9F4EB] py-5 overflow-hidden flex whitespace-nowrap z-20 transform rotate-1 scale-105 origin-center shadow-2xl">
        <motion.div 
          animate={{ x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
          style={{ willChange: "transform" }}
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
