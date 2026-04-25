"use client"

import { shopInfo } from "@/lib/data"
import { Calendar, Sparkles, Instagram, Send } from "lucide-react"
import { motion } from "framer-motion"

export default function ActivityPage() {
  return (
    <div className="min-h-screen bg-[#000000] text-[#F9F4EB] py-32 md:py-48 px-6 relative overflow-hidden" style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}>
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-[#1B3629] rounded-full blur-[300px] opacity-[0.05] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#DC6835] rounded-full blur-[250px] opacity-[0.03] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 text-center">
        {/* Animated Icon */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-12"
        >
          <Sparkles className="text-[#DC6835] w-10 h-10 animate-pulse" />
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-[#DC6835]/30 text-[#DC6835] font-bold text-xs tracking-[0.3em] uppercase mb-10">
             <Calendar size={16} />
             <span>THE DND JOURNAL</span>
          </div>
          
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-12 leading-none">
            STAY <br/> TUNED.
          </h1>
        </motion.div>

        {/* Narrative Placeholder */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-8"
        >
          <p className="text-2xl md:text-3xl leading-relaxed text-[#F9F4EB]/60 italic font-medium">
            Something quietly revolutionary is brewing behind our doors in Semarang. 
          </p>
          <div className="h-px w-24 bg-[#DC6835] mx-auto opacity-30" />
          <p className="text-xl md:text-2xl leading-relaxed text-[#F9F4EB]/40 max-w-2xl mx-auto">
            From hands-on brewing workshops to late-night creative takeovers, our journal will soon be filled with moments that redefine the coffee experience. 
          </p>
        </motion.div>

        {/* Social Links */}
        <motion.div
           initial={{ opacity: 0, y: 30 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.6 }}
           className="mt-24 pt-16 border-t border-white/10"
        >
           <p className="uppercase tracking-[0.4em] text-xs font-black mb-10 opacity-30">Follow the unfolding story</p>
           <div className="flex justify-center gap-8">
              <a 
                href={`https://instagram.com/${shopInfo.social?.instagram.replace('@', '')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="group flex flex-col items-center gap-4 transition-all hover:-translate-y-2"
              >
                 <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#DC6835] group-hover:border-[#DC6835] transition-all">
                    <Instagram size={24} />
                 </div>
                 <span className="text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">Instagram</span>
              </a>
              <button className="group flex flex-col items-center gap-4 transition-all hover:-translate-y-2">
                 <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#F9F4EB] group-hover:text-black group-hover:border-[#F9F4EB] transition-all">
                    <Send size={24} />
                 </div>
                 <span className="text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">Newsletter</span>
              </button>
           </div>
        </motion.div>
      </div>

      {/* Decorative Text */}
      <div className="absolute -bottom-10 -right-10 text-[15rem] font-black opacity-[0.02] select-none pointer-events-none tracking-tighter leading-none">
        JOURNAL
      </div>
    </div>
  )
}
