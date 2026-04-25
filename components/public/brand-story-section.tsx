"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Coffee, Flame, Eye, PenTool } from "lucide-react"

export function BrandStorySection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 80, damping: 20 } }
  }

  return (
    <section className="py-24 md:py-32 px-6 bg-[#2A1B14] text-[#F9F4EB] relative overflow-hidden" style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}>
      
      {/* Decorative Background Assets */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#1B3629] rounded-full blur-[150px] opacity-40 pointer-events-none translate-x-1/2 -translate-y-1/4" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#DC6835] rounded-full blur-[150px] opacity-20 pointer-events-none -translate-x-1/3 translate-y-1/3" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Asymmetric Header Layout - Reduced margin for tighter rhythm */}
        <div className="flex flex-col lg:flex-row gap-16 items-start lg:items-center mb-12">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="flex-1"
          >
            <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-[#DC6835] text-[#DC6835] font-bold text-xs tracking-[0.3em] uppercase mb-8">
              <Flame size={16} />
              <span>THE DND MANIFESTO</span>
            </div>
            
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9]">
              Born From <br/>
              <span className="text-[#DC6835] italic tracking-normal">Restless</span><br/>
              Creativity
            </h2>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="flex-1 text-xl md:text-3xl leading-relaxed font-light text-[#F9F4EB]/80 flex flex-col justify-between"
          >
            <div>
              <p className="mb-6 pointer-events-none">
                We don't just brew coffee. We architect <strong className="text-white font-bold">safe havens</strong> for your wandering thoughts. 
              </p>
              <p className="pointer-events-none mb-4">
                When the city gets too loud, DND is the silent partner to your loudest ideas. Meticulous beans, intentionally curated spaces, zero distractions.
              </p>
            </div>

            {/* Restored Interactive Narrative: The Cup and The Bean (Guaranteed White Line-Art) */}
            <div className="flex justify-center items-end gap-0 lg:gap-6 w-full relative h-[180px] lg:h-[260px] mt-2">

              {/* Character 1: The Cup (Left) */}
              <motion.div 
                 drag
                 dragMomentum={true}
                 whileHover={{ scale: 1.1, cursor: "grab" }}
                 whileDrag={{ scale: 1.25, cursor: "grabbing", rotate: -5 }}
                 animate={{ y: [0, 8, 0] }}
                 transition={{ y: { repeat: Infinity, duration: 4, ease: "easeInOut", type: "tween" } }}
                 onClick={(e) => {
                   const target = e.currentTarget;
                   const bubble = target.querySelector('.speech-bubble');
                   if(bubble) {
                     bubble.classList.remove('opacity-0', 'scale-50', 'pointer-events-none');
                     bubble.classList.add('opacity-100', 'scale-100');
                     setTimeout(() => {
                       bubble.classList.remove('opacity-100', 'scale-100');
                       bubble.classList.add('opacity-0', 'scale-50', 'pointer-events-none');
                     }, 3000);
                   }
                 }}
                 className="relative w-44 h-44 lg:w-72 lg:h-72 opacity-100 z-30 pointer-events-auto"
              >
                <div 
                  className="speech-bubble absolute -top-16 left-1/2 -translate-x-1/2 bg-[#F9F4EB] text-[#2A1B14] font-bold py-3 px-6 rounded-3xl shadow-2xl border-2 border-[#DC6835] whitespace-nowrap z-50 opacity-0 scale-50 pointer-events-none transition-all duration-300 ease-out text-lg"
                >
                   Every cup has a story... 📖
                </div>
                <div className="w-full h-full pointer-events-none">
                  <img 
                    src="/images/story_cartoon_1_transparent.png" 
                    alt="Legacy Cup Mascot" 
                    className="w-full h-full object-contain"
                    style={{ filter: "brightness(0) invert(1)", filterDropShadow: "drop-shadow(0 20px 40px rgba(255,255,255,0.3))" } as any}
                  />
                </div>
              </motion.div>

              {/* Character 2: NEW Cool Bean (Right) */}
              <motion.div 
                 drag
                 dragMomentum={true}
                 whileHover={{ scale: 1.1, cursor: "grab" }}
                 whileDrag={{ scale: 1.25, cursor: "grabbing", rotate: 5 }}
                 animate={{ 
                   y: [-12, 12, -12],
                   scale: [1, 1.03, 1]
                 }}
                 transition={{ 
                   y: { repeat: Infinity, duration: 5, ease: "easeInOut", type: "tween" },
                   scale: { repeat: Infinity, duration: 2.5, ease: "easeInOut", type: "tween" }
                 }}
                 onClick={(e) => {
                   const target = e.currentTarget;
                   const bubble = target.querySelector('.speech-bubble');
                   if(bubble) {
                     bubble.classList.remove('opacity-0', 'scale-50', 'pointer-events-none');
                     bubble.classList.add('opacity-100', 'scale-100');
                     setTimeout(() => {
                       bubble.classList.remove('opacity-100', 'scale-100');
                       bubble.classList.add('opacity-0', 'scale-50', 'pointer-events-none');
                     }, 3000);
                   }
                 }}
                 className="relative w-44 h-44 lg:w-72 lg:h-72 opacity-100 z-40 pointer-events-auto flex items-center justify-center"
              >
                <div 
                  className="speech-bubble absolute -top-16 left-1/2 -translate-x-1/2 bg-[#DC6835] text-white font-bold py-3 px-6 rounded-3xl shadow-2xl border-2 border-[#F9F4EB] whitespace-nowrap z-50 opacity-0 scale-50 pointer-events-none transition-all duration-300 ease-out text-lg"
                >
                   Freshly roasted thoughts! 🧠⚡
                </div>
                <div className="w-full h-full pointer-events-none">
                  <img 
                    src="/images/bean_mascot_transparent.png" 
                    alt="Cool Coffee Bean Mascot" 
                    className="w-full h-full object-contain"
                    style={{ filter: "brightness(0) invert(1)", filterDropShadow: "drop-shadow(0 20px 40px rgba(255,255,255,0.3))" } as any}
                  />
                </div>
              </motion.div>

            </div>
          </motion.div>
        </div>

        {/* Dynamic Masonry-ish Value Props */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 md:grid-cols-12 gap-6"
        >
          {/* Card 1 */}
          <motion.div variants={itemVariants} className="md:col-span-5 bg-[#1B3629] p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
            <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-150 transition-transform duration-700 ease-out">
              <Eye size={160} />
            </div>
            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl mb-6 inline-block">
              <Eye size={24} className="text-[#F9F4EB]" />
            </div>
            <h3 className="text-2xl md:text-3xl font-black mb-3 uppercase tracking-tighter">THE PRODUCTIVE VIBE.</h3>
            <p className="text-base md:text-lg opacity-80 leading-relaxed font-medium">
              We're not a silent library—we're a pulse for productivity. Expect curated playlists, ample power outlets, blazing-fast WiFi, and an atmosphere designed to keep you inspired.
            </p>
          </motion.div>

          {/* Card 2 */}
          <motion.div variants={itemVariants} className="md:col-span-7 bg-[#DC6835] p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
            <div className="absolute -right-8 -bottom-8 opacity-20 group-hover:rotate-45 transition-transform duration-700 ease-out">
              <Coffee size={200} />
            </div>
            <div className="p-4 bg-black/10 backdrop-blur-md rounded-2xl mb-6 inline-block">
              <Coffee size={24} className="text-[#2A1B14]" />
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-[#2A1B14] mb-3 uppercase tracking-tighter">SPECIALTY ARSENAL.</h3>
            <p className="text-base md:text-lg text-[#2A1B14]/80 leading-relaxed max-w-xl font-bold">
              Handraised in Indonesia. We source our beans with a meticulous soul, hand-graded and hand-roasted to fuel your restless creativity with uncompromising precision.
            </p>
          </motion.div>

          {/* Card 3 (Full Width) */}
          <motion.div variants={itemVariants} className="md:col-span-12 bg-[#F9F4EB] text-[#2A1B14] p-8 md:p-12 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-10 group cursor-pointer hover:bg-white transition-colors duration-500">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-[#1B3629]/10 rounded-2xl">
                  <PenTool size={28} className="text-[#1B3629]" />
                </div>
                <h3 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">CREATORS&apos; CANVAS.</h3>
              </div>
              <p className="text-lg md:text-xl opacity-80 leading-relaxed font-bold max-w-4xl italic">
                A hideout for the architects of the future. You might walk in for the specialty coffee, but you stay for the collaboration in our sanctuary of handraised moments.
              </p>
            </div>
            <motion.div 
               animate={{ rotate: 360 }}
               transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
               className="w-24 h-24 rounded-full border-4 border-dashed border-[#DC6835] flex items-center justify-center flex-shrink-0"
            >
              <span className="font-bold tracking-widest text-[#DC6835] uppercase text-xs">Create</span>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Background Walking Human Overlay - Optimized for mobile */}
      <div className="absolute top-1/2 left-0 w-full overflow-hidden pointer-events-none z-0 opacity-[0.03] md:opacity-[0.05]">
        <motion.div 
          animate={{ x: ["120vw", "-120vw"] }}
          transition={{ repeat: Infinity, duration: 45, ease: "linear", type: "tween" }}
          style={{ willChange: "transform" }}
          className="w-[800px] h-[800px]"
        >
          <img 
            src="/images/human_customer_transparent.png" 
            alt="Moving Customer Background" 
            className="w-full h-full object-contain"
          />
        </motion.div>
      </div>
    </section>
  )
}
