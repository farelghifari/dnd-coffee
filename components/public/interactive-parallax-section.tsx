"use client"

import { useState, useEffect } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { Coffee, ArrowRight } from "lucide-react"

export function InteractiveParallaxSection() {
  const [isMobile, setIsMobile] = useState(false)
  
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  
  const springConfig = { damping: 25, stiffness: 70 }
  const smoothX = useSpring(mouseX, springConfig)
  const smoothY = useSpring(mouseY, springConfig)

  const layer0X = useTransform(smoothX, (v) => isMobile ? 0 : v * 15)
  const layer0Y = useTransform(smoothY, (v) => isMobile ? 0 : v * 15)

  const h2Y = useTransform(smoothY, (v) => isMobile ? 0 : v * 10)
  const pY = useTransform(smoothY, (v) => isMobile ? 0 : v * 15)

  const mascotX = useTransform(smoothX, (v) => isMobile ? 0 : v * -70)
  const mascotY = useTransform(smoothY, (v) => isMobile ? 120 : (v * -40) + 120)
  const mascotRotate = useTransform(smoothX, (v) => isMobile ? 0 : v * 5)

  const float1X = useTransform(smoothX, (v) => isMobile ? -50 : v * 150)
  const float1Y = useTransform(smoothY, (v) => isMobile ? 0 : v * 120)
  const float1Rotate = useTransform(smoothX, (v) => isMobile ? -15 : v * 20)

  const float2X = useTransform(smoothX, (v) => isMobile ? 50 : v * -200)
  const float2Y = useTransform(smoothY, (v) => isMobile ? 0 : v * -150)
  const float2Rotate = useTransform(smoothX, (v) => isMobile ? 25 : v * -30)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener("resize", checkMobile)

    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth < 768) return; 
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      mouseX.set(x)
      mouseY.set(y)
    }

    if (!isMobile) {
      window.addEventListener("mousemove", handleMouseMove)
    }
    
    return () => {
      window.removeEventListener("resize", checkMobile)
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [isMobile, mouseX, mouseY])

  return (
    <section className="relative w-full h-[700px] md:h-[950px] bg-[#1C1C1E] overflow-hidden flex flex-col items-center justify-center border-y-8 border-[#D4A24A] font-sans">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 bg-[#1C1C1E]" />
      <div className="absolute inset-0 opacity-20 z-1 bg-[radial-gradient(circle_at_center,_#D4A24A_0%,_transparent_80%)]" />

      {/* Layer 0: Background Parallax Pattern */}
      <motion.div 
        style={{ x: layer0X, y: layer0Y, willChange: isMobile ? "auto" : "transform" }}
        className="absolute inset-0 flex items-center justify-center opacity-5 z-2 pointer-events-none"
      >
        <div className="grid grid-cols-3 md:grid-cols-4 gap-32 transform scale-150">
           {Array(12).fill(0).map((_, i) => (
             <div key={i} className="text-[#515153] rotate-45">
                <Coffee size={120} strokeWidth={0.5} />
             </div>
           ))}
        </div>
      </motion.div>

      {/* Main Content Layout */}
      <div className="relative z-20 text-center pointer-events-none px-6 pt-16 md:pt-24 max-w-5xl mb-auto">
        <motion.h2 
          style={{ y: h2Y }}
          className="text-6xl md:text-8xl lg:text-[9rem] font-black text-[#BFC0C2] tracking-tighter mb-4 leading-[0.8] drop-shadow-2xl" 
        >
          Behind <br className="md:hidden"/> The Barista.
        </motion.h2>
        <motion.p 
          style={{ y: pY, fontFamily: "'Bryndan Write', 'Kalam', cursive" }}
          className="text-[#D4A24A] text-2xl md:text-4xl lg:text-5xl font-black italic mt-4" 
        >
          Brewing magic in every drop.
        </motion.p>
      </div>

      {/* Interactive Barista Mascot */}
      <motion.div 
        drag
        dragConstraints={{ left: -300, right: 300, top: -200, bottom: 200 }}
        whileDrag={{ scale: 1.1, zIndex: 100 }}
        style={{ x: mascotX, y: mascotY, rotate: mascotRotate, willChange: isMobile ? "auto" : "transform" }}
        className="absolute bottom-[-10%] md:bottom-[-15%] left-1/2 -translate-x-1/2 z-30 w-[450px] md:w-[850px] cursor-grab active:cursor-grabbing pointer-events-auto"
      >
         <div className="relative">
           <motion.div 
             animate={{ scale: [1, 1.05, 1], rotate: [5, 8, 5] }}
             transition={{ repeat: Infinity, duration: 6, ease: "easeInOut", type: "tween" }}
             className="absolute -top-20 md:-top-28 left-[75%] md:left-[85%] bg-[#D4A24A] text-white font-bold py-4 px-8 rounded-full rounded-bl-none shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 border-[#1C1C1E] text-xl md:text-3xl whitespace-nowrap z-50" 
             style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}
           >
             Seeking inspiration? ☕✨
           </motion.div>
           <img 
             src="/images/human_barista_transparent.png" 
             className="w-full h-auto object-contain filter invert brightness-[2]" 
             alt="Interactive Human Barista" 
           />
         </div>
      </motion.div>

      {/* Floating Accents */}
      <motion.div 
        style={{ x: float1X, y: float1Y, rotate: float1Rotate, willChange: isMobile ? "auto" : "transform" }}
        className="absolute top-[30%] left-[5%] md:left-[15%] z-40 text-[#D4A24A] opacity-80"
      >
        <div className="p-8 bg-[#1C1C1E]/5 rounded-[2rem] border-2 border-[#1C1C1E]/10 shadow-2xl">
           <Coffee size={120} strokeWidth={1} />
        </div>
      </motion.div>

      <motion.div 
        style={{ x: float2X, y: float2Y, rotate: float2Rotate, willChange: isMobile ? "auto" : "transform" }}
        className="absolute bottom-[20%] right-[5%] md:right-[10%] z-40 text-[#515153] opacity-60"
      >
        <div className="p-10 bg-[#D4A24A]/10 rounded-full border-2 border-[#D4A24A]/30 shadow-2xl">
           <ArrowRight size={100} strokeWidth={0.5} />
        </div>
      </motion.div>

      {/* Bottom Overlay Fade */}
      <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-[#1C1C1E] via-[#1C1C1E]/60 to-transparent z-50 pointer-events-none" />
      
    </section>
  )
}
