"use client"

import { motion } from "framer-motion"
import { Users, PenTool, Coffee, MonitorPlay } from "lucide-react"

export function CommunityHighlightsSection() {
  return (
    <section className="py-24 md:py-32 px-6 bg-[#1B3629] text-[#F9F4EB] font-sans relative overflow-hidden">
      
      {/* Decorative Blur Orbs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#DC6835] rounded-full blur-[150px] opacity-20 pointer-events-none translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#F9F4EB] rounded-full blur-[120px] opacity-10 pointer-events-none -translate-x-1/2 translate-y-1/3" />

      <div className="max-w-7xl mx-auto relative z-10 flex flex-col xl:flex-row items-center gap-16">
        
        {/* Left Typography Block */}
        <div className="flex-1 w-full relative z-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-[#DC6835] text-[#DC6835] font-bold text-xs tracking-[0.3em] uppercase mb-8 bg-[#1B3629]">
              <Users size={16} />
              <span>Not Just A "Community"</span>
            </div>
            
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-8 leading-[1.1]">
              The Creators' <br/>
              <span className="text-[#DC6835]" style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}>Canvas.</span>
            </h2>
            
            <p className="text-xl md:text-2xl leading-relaxed text-[#F9F4EB]/80 font-light mb-6 max-w-xl">
              We ditched the corporate bulletin board. You won't find boring networking events here. Instead, you'll find a living, breathing sanctuary of coders, designers, and late-night thinkers building the future in silence.
            </p>

            <p className="text-lg leading-relaxed text-[#F9F4EB]/60 font-medium mb-12 max-w-xl italic border-l-4 border-[#DC6835] pl-6">
              "It started with a simple idea: creative minds shouldn't have to choose between exceptional single-origin coffee and an environment that actually lets them work. Every table is a designated focus zone. Every cup is brewed to keep you in 'the flow'."
            </p>

            <ul className="flex flex-col gap-6 text-lg font-medium opacity-90">
              <li className="flex items-center gap-4">
                <div className="p-3 bg-[#DC6835]/20 rounded-full text-[#DC6835]">
                  <MonitorPlay size={24} />
                </div>
                <span>Strict 'Headphones On' zones for deep work.</span>
              </li>
              <li className="flex items-center gap-4">
                <div className="p-3 bg-[#DC6835]/20 rounded-full text-[#DC6835]">
                  <PenTool size={24} />
                </div>
                <span>Unlimited power outlets & gigabit wifi.</span>
              </li>
              <li className="flex items-center gap-4">
                <div className="p-3 bg-[#DC6835]/20 rounded-full text-[#DC6835]">
                  <Coffee size={24} />
                </div>
                <span>Endless caffeine supply drops directly to your desk.</span>
              </li>
            </ul>
          </motion.div>
        </div>

        {/* Right Mood-board / Scattered Pictures Block */}
        <div className="flex-1 w-full h-[400px] md:h-[500px] relative mt-12 xl:mt-0">
          
          <motion.div 
            initial={{ opacity: 0, rotate: -15, scale: 0.8, x: -50 }}
            whileInView={{ opacity: 1, rotate: -6, scale: 1, x: 0 }}
            whileHover={{ scale: 1.05, rotate: -2, zIndex: 30 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 100 }}
            className="absolute top-0 left-0 md:left-10 w-48 h-56 md:w-64 md:h-72 bg-[#F9F4EB] p-3 md:p-4 rounded-xl shadow-2xl shadow-black/50 rotate-[-6deg] z-10 cursor-pointer"
          >
            <div className="w-full h-4/5 bg-[#2A1B14] rounded-lg overflow-hidden flex items-center justify-center p-3 md:p-4 isolate">
              <img src="/images/human_customer_transparent.png" alt="Creative Space" className="w-full h-full object-contain filter invert brightness-[2]" />
            </div>
            <p className="text-[#2A1B14] font-bold text-center mt-2 md:mt-3 text-sm md:text-base" style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}>Morning Grinds</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, rotate: 15, scale: 0.8, x: 50 }}
            whileInView={{ opacity: 1, rotate: 8, scale: 1, x: 0 }}
            whileHover={{ scale: 1.05, rotate: 2, zIndex: 30 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
            className="absolute top-16 right-0 md:top-20 md:right-10 w-52 h-60 md:w-72 md:h-80 bg-[#F9F4EB] p-3 md:p-4 pb-6 md:pb-8 rounded-xl shadow-2xl shadow-black/50 rotate-[8deg] z-20 cursor-pointer"
          >
            <div className="w-full h-[85%] bg-[#1B3629] rounded-lg overflow-hidden flex items-center justify-center p-2 isolate">
               <img src="/images/human_barista_transparent.png" className="w-full h-full object-contain filter invert brightness-[2]" alt="Community Vibe" />
            </div>
            <p className="text-[#2A1B14] font-bold text-center mt-2 md:mt-4 text-sm md:text-lg" style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}>Midnight Epiphanies</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.05, zIndex: 30 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 100, delay: 0.4 }}
            className="absolute bottom-4 left-1/4 md:bottom-0 w-44 h-48 md:w-60 md:h-64 bg-[#F9F4EB] p-3 md:p-4 rounded-xl shadow-2xl shadow-black/50 -rotate-[2deg] z-25 cursor-pointer"
          >
            <div className="w-full h-4/5 bg-[#DC6835] rounded-lg overflow-hidden flex items-center justify-center p-2 isolate">
              <img src="/images/human_customer_transparent.png" className="w-full h-full object-contain scale-x-[-1] filter invert brightness-[2]" alt="Code and Coffee" />
            </div>
            <p className="text-[#2A1B14] font-bold text-center mt-2 md:mt-3 text-xs md:text-base" style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}>Code + Caffeine</p>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
