"use client"

import { motion } from "framer-motion"
import { Navigation } from "@/components/public/navigation"
import { MapPin, Clock, Phone, Instagram, MessageCircle, ExternalLink, ArrowLeft, Wifi, Plug, Laptop, Wind } from "lucide-react"
import { shopInfo } from "@/lib/data"
import Link from "next/link"

export default function VisitPage() {
  return (
    <main className="min-h-screen bg-[#F9F4EB]">
      <Navigation />

      <section className="pt-32 pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#DC6835] mb-12 hover:gap-4 transition-all" style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}>
            <ArrowLeft size={16} /> BACK TO HOME
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-12"
            >
              <div>
                <span className="text-xs font-black tracking-[0.4em] text-[#DC6835] uppercase mb-4 block">Headquarters</span>
                <h1 className="text-6xl md:text-8xl font-black text-[#2A1B14] leading-[0.8] tracking-tighter mb-8">
                  Visit Our <br /><span className="text-[#DC6835]">Sanctuary.</span>
                </h1>
                <p className="text-xl text-[#2A1B14]/70 max-w-md font-medium" style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}>
                  A space designed to help you disappear into your deepest work.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-[#DC6835]">
                    <MapPin size={20} />
                    <h3 className="font-black text-xs tracking-widest uppercase">Location</h3>
                  </div>
                  <p className="font-bold text-[#2A1B14]">
                    {shopInfo.address}
                  </p>
                  <a
                    href={shopInfo.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-black text-[#DC6835] hover:gap-4 transition-all"
                  >
                    GET DIRECTIONS <ExternalLink size={14} />
                  </a>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-[#DC6835]">
                    <Clock size={20} />
                    <h3 className="font-black text-xs tracking-widest uppercase">Sessions</h3>
                  </div>
                  <div className="space-y-1 font-bold text-[#2A1B14]">
                    <p>Mon - Sun: {shopInfo.hours.weekday}</p>
                    <p className="text-xs opacity-40 uppercase tracking-tighter italic">Last Batch 23:30</p>
                  </div>
                </div>
              </div>

              <div className="pt-12 border-t border-[#2A1B14]/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {/* Contact & Social */}
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-[#DC6835]">
                        <Phone size={20} />
                        <h3 className="font-black text-xs tracking-widest uppercase">Contact</h3>
                      </div>
                      <p className="font-bold text-[#2A1B14]">{shopInfo.phone}</p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-[#DC6835]">
                        <MessageCircle size={20} />
                        <h3 className="font-black text-xs tracking-widest uppercase">Social</h3>
                      </div>
                      <div className="flex gap-4">
                        <a href={`https://instagram.com/${shopInfo.social.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-[#2A1B14] hover:text-[#DC6835] transition-colors">
                          <Instagram size={20} />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Amenities */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-[#DC6835]">
                      <Wifi size={20} />
                      <h3 className="font-black text-xs tracking-widest uppercase">Amenities</h3>
                    </div>
                    <ul className="space-y-3 font-bold text-[#2A1B14]">
                      <li className="flex items-center gap-3">
                        <Wifi size={16} className="text-[#2A1B14]/40" />
                        <span>High-Speed WiFi</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <Plug size={16} className="text-[#2A1B14]/40" />
                        <span>Ample Power Outlets</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <Laptop size={16} className="text-[#2A1B14]/40" />
                        <span>Remote Work Friendly</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <Wind size={16} className="text-[#2A1B14]/40" />
                        <span>Indoor Smoking Area</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative h-[600px] rounded-[3rem] overflow-hidden shadow-2xl border-2 border-[#2A1B14]/5"
            >
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3960.258179902994!2d110.40710899999999!3d-6.978833199999995!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e708b85cbe263fb%3A0x33e46ec6b85f5d89!2sDo%20Not%20Disturb!5e0!3m2!1sen!2ssg!4v1777114121203!5m2!1sen!2ssg"
                width="100%"
                height="100%"
                style={{ border: 0, filter: "grayscale(1) contrast(1.2) opacity(0.8)" }}
                allowFullScreen
                loading="lazy"
              />
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  )
}
