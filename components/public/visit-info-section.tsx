"use client"

import { motion } from "framer-motion"
import { MapPin, Clock, Navigation, ExternalLink, Coffee } from "lucide-react"
import { shopInfo } from "@/lib/data"

export function VisitInfoSection() {
  return (
    <section id="visit" className="bg-[#F9F4EB] py-24 md:py-32 px-6 font-sans relative overflow-hidden">
      {/* Decors */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-[#DC6835]/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
      
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 lg:gap-20 items-center">
        
        {/* Left: Text Info */}
        <div className="flex-1 w-full order-2 lg:order-1">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 text-[#DC6835] font-black tracking-[0.4em] uppercase text-xs mb-8">
              <Navigation size={16} fill="currentColor" />
              <span>HEADQUARTERS</span>
            </div>
            
            <h2 className="text-5xl md:text-7xl font-black text-[#2A1B14] tracking-tighter leading-[0.8] mb-12">
              Find Your <br/>
              <span className="text-[#DC6835]">Safe Haven.</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 border-t border-[#2A1B14]/10 pt-12">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-[#DC6835]">
                  <MapPin size={24} />
                  <span className="font-black uppercase tracking-widest text-xs">LOCATION</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-[#2A1B14] leading-tight max-w-xs">
                  {shopInfo.address.split(', Semarang Tengah')[0]}
                </p>
                <a 
                  href={shopInfo.mapsUrl} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-black text-[#DC6835] hover:gap-4 transition-all"
                >
                  OPEN IN GOOGLE MAPS <ExternalLink size={14} />
                </a>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-[#DC6835]">
                  <Clock size={24} />
                  <span className="font-black uppercase tracking-widest text-xs">SESSIONS</span>
                </div>
                <div className="space-y-1">
                  <p className="text-lg md:text-xl font-bold text-[#2A1B14]">Mon - Fri: {shopInfo.hours.weekday}</p>
                  <p className="text-lg md:text-xl font-bold text-[#2A1B14]">Sat - Sun: {shopInfo.hours.weekend}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#2A1B14] text-[#F9F4EB] p-8 rounded-[2rem] flex flex-col md:flex-row items-center gap-8 shadow-xl">
              <div className="flex-1">
                <h4 className="text-xl font-black mb-2 uppercase tracking-tight">Need a dedicated desk?</h4>
                <p className="opacity-70 text-sm font-medium">Reservations available for groups and deep-work sessions.</p>
              </div>
              <button className="px-8 py-4 bg-[#DC6835] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:scale-105 transition-transform">
                BOOK A SESSION
              </button>
            </div>
          </motion.div>
        </div>

        {/* Right: Map Embed */}
        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="flex-1 w-full order-1 lg:order-2 h-[400px] lg:h-[600px] relative rounded-[3rem] overflow-hidden shadow-2xl border-2 border-[#2A1B14]/5"
        >
          <iframe 
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3960.258179902994!2d110.40710899999999!3d-6.978833199999995!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e708b85cbe263fb%3A0x33e46ec6b85f5d89!2sDo%20Not%20Disturb!5e0!3m2!1sen!2ssg!4v1777114121203!5m2!1sen!2ssg"
            width="100%" 
            height="100%" 
            style={{ border: 0, filter: "grayscale(1) contrast(1.2) invert(0.9)" }} 
            allowFullScreen 
            loading="lazy" 
          />
        </motion.div>

      </div>
    </section>
  )
}
