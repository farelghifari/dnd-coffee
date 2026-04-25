"use client"

import { motion } from "framer-motion"
import { Coffee, ArrowRight, UtensilsCrossed, Star, Cloud, Droplets, Flame, Leaf, Sparkles } from "lucide-react"
import Link from "next/link"

const menuStructure = [
  {
    category: "Classic Coffee",
    desc: "Uncompromising traditional espresso beverages.",
    color: "bg-[#F9F4EB]",
    textColor: "text-[#2A1B14]",
    icon: <Coffee size={24} />,
    items: [
      { name: "Americano", price: "20k" },
      { name: "Cafe Latte", price: "25k" },
      { name: "Cappuccino", price: "24k" },
      { name: "Magic", price: "24k" },
      { name: "Dirty Latte", price: "26k" }
    ]
  },
  {
    category: "Flavor Coffee",
    desc: "Sweet, curated blends with a twisted personality.",
    color: "bg-[#1B3629]",
    textColor: "text-[#F9F4EB]",
    icon: <Sparkles size={24} />,
    items: [
      { name: "Brown Sugar Signature", price: "22k" },
      { name: "Mango Sticky Rice", price: "24k" },
      { name: "Butterscotch", price: "24k" },
      { name: "Hazelnut", price: "24k" }
    ]
  },
  {
    category: "Non Coffee",
    desc: "For those looking for focus beyond caffeine.",
    color: "bg-[#DC6835]",
    textColor: "text-[#F9F4EB]",
    icon: <Leaf size={24} />,
    items: [
      { name: "Peach Tea", price: "18k" },
      { name: "Lychee Tea", price: "18k" },
      { name: "Apple Tea", price: "18k" },
      { name: "Original Tea", price: "16k" },
      { name: "Matcha Latte", price: "27k" },
      { name: "Cookies n Cream", price: "25k" }
    ]
  },
  {
    category: "Cake & Pastries",
    desc: "Freshly baked daily. The perfect companion.",
    color: "bg-[#1B3629]",
    textColor: "text-[#F9F4EB]",
    icon: <UtensilsCrossed size={24} />,
    comingSoon: true,
    items: [
      { name: "Burnt Cheesecake", price: "22k" },
      { name: "Butter Croissant", price: "24k" },
      { name: "Nutella Croissant", price: "26k" },
      { name: "Almond Croissant", price: "26k" },
      { name: "Dark Chocolate Cookies", price: "15k" },
      { name: "Red Velvet Cookies", price: "15k" },
      { name: "Fudgy Brownies", price: "15k" }
    ]
  },
  {
    category: "Snacks",
    desc: "Light bites for heavy thinking sessions.",
    color: "bg-[#F9F4EB]",
    textColor: "text-[#2A1B14]",
    icon: <Droplets size={24} />,
    items: [
      { name: "Mix Platter", price: "28k" },
      { name: "French Fries", price: "20k" },
      { name: "Crispy Tofu", price: "18k" },
      { name: "Stuffed Tofu", price: "20k" },
      { name: "Dimsum", price: "22k" }
    ]
  },
  {
    category: "Others",
    desc: "Essential sidekicks for your session.",
    color: "bg-[#DC6835]",
    textColor: "text-[#F9F4EB]",
    icon: <Star size={24} />,
    items: [
      { name: "Mineral Water", price: "8k" }
    ]
  }
]

export function MenuStorySection() {
  return (
    <section className="bg-[#2A1B14] text-[#F9F4EB] py-24 md:py-32 relative overflow-hidden" style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}>
      
      {/* Decorative Assets - Subtle Brown Grain */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#DC6835]/5 to-transparent pointer-events-none" />

      <div className="container mx-auto px-6 max-w-7xl relative z-10">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl"
          >
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">
              Our Curated <br/>
              <span className="text-[#DC6835]">Arsenal.</span>
            </h2>
            <p className="text-xl md:text-2xl opacity-80 font-medium">
              Everything you need to fuel your focus. Presented transparently, crafted intentionally.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <Link 
              href="/links" 
              className="inline-flex items-center gap-2 bg-[#F9F4EB] text-[#2A1B14] hover:bg-[#DC6835] hover:text-white px-8 py-5 rounded-full font-bold text-lg transition-colors duration-300 shadow-xl hover:scale-105"
            >
              Order Online <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>

        {/* The "Show Everything" Menu Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {menuStructure.map((section: any, sectionIdx) => (
            <motion.div 
              key={sectionIdx}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: sectionIdx * 0.1, type: "spring", stiffness: 80 }}
              className={`${section.color} ${section.textColor} p-8 md:p-10 rounded-[2.5rem] shadow-2xl flex flex-col h-[480px]`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className={`p-4 rounded-2xl ${section.color === 'bg-[#F9F4EB]' ? 'bg-[#2A1B14]/5' : 'bg-white/10'}`}>
                  {section.icon}
                </div>
              </div>
              
              <h3 className="text-3xl font-black mb-3 flex flex-wrap items-center gap-3">
                {section.comingSoon && (
                  <motion.span 
                    animate={{ rotate: [-2, 2, -2], scale: [1, 1.05, 1] }} 
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    className="px-3 py-1 bg-black/80 text-white text-[10px] sm:text-xs rounded-full italic tracking-widest uppercase shadow-xl"
                  >
                    COMING SOON
                  </motion.span>
                )}
                <span className={section.comingSoon ? "line-through opacity-60" : ""}>
                  {section.category}
                </span>
              </h3>
              <p className="text-sm font-medium opacity-80 mb-6">{section.desc}</p>
              
              <div className={`flex flex-col gap-6 mt-auto overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-[#DC6835]/30 scrollbar-track-transparent ${section.comingSoon ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                {section.items.map((item: any, itemIdx: number) => (
                   <div key={itemIdx} className="flex items-end justify-between group">
                    <div className="flex flex-col">
                      <span className="font-bold text-lg tracking-wide uppercase group-hover:translate-x-2 transition-transform duration-300">
                        {item.name}
                      </span>
                    </div>
                    <div className={`flex-grow border-b-2 border-dotted mx-4 mb-2 opacity-30 ${section.textColor.replace('text-', 'border-')}`} />
                    <span className="font-black text-xl">
                      {item.price}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Elegantly Styled Ingredient & Ordering Section (Not a rigid table) */}
        <div className="mt-32 pt-16 border-t border-[#F9F4EB]/10">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h4 className="text-[#DC6835] font-bold tracking-[0.3em] uppercase text-xs sm:text-sm mb-3">Integrity in Every Drop</h4>
            <p className="text-3xl font-black">100% Genuine Ingredients</p>
          </motion.div>

          {/* Floating Ingredient Pills */}
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto mb-28"
          >
            {[
              { label: "SPECIALTY BEANS", icon: <Coffee size={24} /> },
              { label: "FRESH MILK", icon: <Droplets size={24} /> },
              { label: "BROWN SUGAR", icon: <Flame size={24} /> },
              { label: "PURE MATCHA", icon: <Leaf size={24} /> },
              { label: "PREMIUM FRUIT", icon: <Cloud size={24} /> },
              { label: "EUROPEAN BUTTER", icon: <Sparkles size={24} /> }
            ].map((ing, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ scale: 1.05, backgroundColor: "rgba(220,104,53, 0.15)", borderColor: "rgba(220,104,53, 0.4)" }}
                className="flex items-center gap-4 px-6 py-4 bg-[#F9F4EB]/5 backdrop-blur-sm rounded-full border border-[#F9F4EB]/10 transition-all duration-300 w-full sm:w-auto justify-center cursor-default"
              >
                <div className="text-[#DC6835]">{ing.icon}</div>
                <span className="font-bold tracking-widest text-sm uppercase">{ing.label}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Delivery Platforms section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <span className="text-[#F9F4EB]/40 font-bold tracking-[0.3em] uppercase text-sm mb-8 block font-sans">
              DELIVERED TO YOUR DESK:
            </span>
            <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-10 text-2xl sm:text-3xl font-black uppercase text-[#DC6835] hover:text-[#F9F4EB] transition-colors duration-500">
               <span className="cursor-pointer hover:scale-110 transition-transform">GOFOOD</span>
               <span className="w-2 h-2 rounded-full bg-[#F9F4EB]/20 hidden sm:block"></span>
               <span className="cursor-pointer hover:scale-110 transition-transform">GRABFOOD</span>
               <span className="w-2 h-2 rounded-full bg-[#F9F4EB]/20 hidden sm:block"></span>
               <span className="cursor-pointer hover:scale-110 transition-transform">SHOPEE</span>
            </div>

            {/* Restored Ending Interactive Narrative Cartoon */}
            <motion.div 
               drag
               dragMomentum={true}
               whileHover={{ scale: 1.1, cursor: "grab" }}
               whileDrag={{ scale: 1.2, cursor: "grabbing" }}
               animate={{ rotate: [-5, 5, -5], y: [0, 5, 0] }}
               transition={{ 
                  rotate: { repeat: Infinity, duration: 5, ease: "easeInOut", type: "tween" }, 
                  y: { repeat: Infinity, duration: 5, ease: "easeInOut", type: "tween" } 
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
               className="relative lg:absolute lg:-right-6 lg:bottom-0 mt-16 lg:mt-0 mx-auto w-48 h-48 opacity-60 hidden md:block z-30 pointer-events-auto"
            >
              <div 
                className="speech-bubble absolute -top-10 -left-16 bg-[#F9F4EB] text-[#DC6835] text-sm font-bold py-3 px-5 rounded-3xl rounded-br-none shadow-2xl border-2 border-[#1B3629]/20 whitespace-nowrap z-50 opacity-0 scale-50 pointer-events-none origin-bottom-right transition-all duration-300 ease-out"
                style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}
              >
                Delivery? I'm your guy! 🛵
              </div>

              <div className="w-full h-full pointer-events-none">
                <img 
                  src="/images/story_cartoon_1_transparent.png" 
                  alt="Delivery Cup Mascot" 
                  className="w-full h-full object-contain pointer-events-none drop-shadow-2xl"
                  style={{ transform: "scaleX(-1)" }} 
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 w-full overflow-hidden pointer-events-none z-0 opacity-10">
        <motion.div 
          animate={{ x: ["100vw", "-100vw"] }}
          transition={{ repeat: Infinity, duration: 45, ease: "linear", type: "tween" }}
          className="w-[400px] h-[400px]"
        >
          <img 
            src="/images/story_cartoon_1_transparent.png" 
            alt="Delivery Cup Mascot Background" 
            className="w-full h-full object-contain"
            style={{ transform: "scaleX(-1)" }} 
          />
        </motion.div>
      </div>

    </section>
  )
}
