"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Coffee, ArrowRight } from "lucide-react"

export function InteractiveParallaxSection() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener("resize", checkMobile)

    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth < 768) return; // Skip on mobile
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      setMousePosition({ x, y })
    }

    if (!isMobile) {
      window.addEventListener("mousemove", handleMouseMove)
    }
    
    return () => {
      window.removeEventListener("resize", checkMobile)
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [isMobile])

  return (
    <section className="relative w-full h-[700px] md:h-[950px] bg-[#2A1B14] overflow-hidden flex flex-col items-center justify-center border-y-8 border-[#DC6835] font-sans">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 bg-[#2A1B14]" />
      <div className="absolute inset-0 opacity-20 z-1 bg-[radial-gradient(circle_at_center,_#DC6835_0%,_transparent_80%)]" />

      {/* Layer 0: Background Parallax Pattern - Throttled for performance */}
      <motion.div 
        animate={{ 
          x: isMobile ? 0 : mousePosition.x * 15, 
          y: isMobile ? 0 : mousePosition.y * 15,
        }}
        transition={{ type: "spring", stiffness: 30, damping: 25 }}
        style={{ willChange: isMobile ? "auto" : "transform" }}
        className="absolute inset-0 flex items-center justify-center opacity-5 z-2 pointer-events-none"
      >
        <div className="grid grid-cols-3 md:grid-cols-4 gap-32 transform scale-150">
           {Array(12).fill(0).map((_, i) => (
             <div key={i} className="text-[#F9F4EB] rotate-45">
                <Coffee size={120} strokeWidth={0.5} />
             </div>
           ))}
        </div>
      </motion.div>

      {/* Main Content Layout - Pushed higher to avoid mascot overlap */}
      <div className="relative z-20 text-center pointer-events-none px-6 pt-16 md:pt-24 max-w-5xl mb-auto">
        <motion.h2 
          animate={{ y: mousePosition.y * 10 }}
          className="text-6xl md:text-8xl lg:text-[9rem] font-black text-[#F9F4EB] tracking-tighter mb-4 leading-[0.8]" 
          style={{ filter: "drop-shadow(0 15px 30px rgba(0,0,0,1))" }}
        >
          Behind <br className="md:hidden"/> The Barista.
        </motion.h2>
        <motion.p 
          animate={{ y: mousePosition.y * 15 }}
          className="text-[#DC6835] text-2xl md:text-4xl lg:text-5xl font-black italic mt-4" 
          style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}
        >
          Brewing magic in every drop.
        </motion.p>
      </div>

      {/* Interactive Barista Mascot (Draggable & Parallax) */}
      <motion.div 
        drag
        dragConstraints={{ left: -300, right: 300, top: -200, bottom: 200 }}
        whileDrag={{ scale: 1.1, zIndex: 100 }}
        animate={{ 
          x: isMobile ? 0 : mousePosition.x * -70, 
          y: isMobile ? 120 : (mousePosition.y * -40) + 120, // Pushing it down from the text
          rotate: isMobile ? 0 : mousePosition.x * 5
        }}
        transition={{ type: "spring", stiffness: 50, damping: 15 }}
        style={{ willChange: isMobile ? "auto" : "transform" }}
        className="absolute bottom-[-10%] md:bottom-[-15%] left-1/2 -translate-x-1/2 z-30 w-[450px] md:w-[850px] cursor-grab active:cursor-grabbing pointer-events-auto"
      >
         <div className="relative">
           <motion.div 
             animate={{ 
               scale: [1, 1.05, 1],
               rotate: [5, 8, 5]
             }}
             transition={{ repeat: Infinity, duration: 6, ease: "easeInOut", type: "tween" }}
             className="absolute -top-20 md:-top-28 left-[75%] md:left-[85%] bg-[#DC6835] text-white font-bold py-4 px-8 rounded-full rounded-bl-none shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 border-[#F9F4EB] text-xl md:text-3xl whitespace-nowrap z-50" 
             style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}
           >
             Seeking inspiration? ☕✨
           </motion.div>
           <img 
             src="/images/human_barista_transparent.png" 
             className="w-full h-auto object-contain filter invert brightness-[2] drop-shadow-[0_10px_40px_rgba(255,255,255,0.2)]" 
             alt="Interactive Human Barista" 
           />
         </div>
      </motion.div>

      {/* Floating Accents - Throttled on mobile */}
      <motion.div 
        animate={{ 
          x: isMobile ? -50 : mousePosition.x * 150, 
          y: isMobile ? 0 : mousePosition.y * 120, 
          rotate: isMobile ? -15 : mousePosition.x * 20 
        }}
        transition={{ type: "spring", stiffness: 100, damping: isMobile ? 20 : 10 }}
        style={{ willChange: isMobile ? "auto" : "transform" }}
        className="absolute top-[30%] left-[5%] md:left-[15%] z-40 text-[#DC6835] opacity-80"
      >
        <div className="p-8 bg-[#F9F4EB]/5 backdrop-blur-xl rounded-[2rem] border-2 border-[#F9F4EB]/10 rotate-[-15deg] shadow-2xl">
           <Coffee size={120} strokeWidth={1} />
        </div>
      </motion.div>

      <motion.div 
        animate={{ 
          x: isMobile ? 50 : mousePosition.x * -200, 
          y: isMobile ? 0 : mousePosition.y * -150, 
          rotate: isMobile ? 25 : mousePosition.x * -30 
        }}
        transition={{ type: "spring", stiffness: 80, damping: isMobile ? 20 : 8 }}
        style={{ willChange: isMobile ? "auto" : "transform" }}
        className="absolute bottom-[20%] right-[5%] md:right-[10%] z-40 text-[#F9F4EB] opacity-60"
      >
        <div className="p-10 bg-[#DC6835]/10 backdrop-blur-2xl rounded-full border-2 border-[#DC6835]/30 rotate-[25deg] shadow-2xl">
           <ArrowRight size={100} strokeWidth={0.5} />
        </div>
      </motion.div>

      {/* Bottom Overlay Fade */}
      <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-[#2A1B14] via-[#2A1B14]/60 to-transparent z-50 pointer-events-none" />
      
    </section>
  )
}
