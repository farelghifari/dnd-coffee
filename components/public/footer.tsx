import Link from "next/link"
import { shopInfo } from "@/lib/data"
import { Instagram, MessageCircle, MapPin, Clock, Mail, ExternalLink, Send, Music, Globe } from "lucide-react"
import config from "@/lib/links-config.json"

export function Footer() {
  return (
    <footer id="visit" className="bg-[#000000] text-[#F9F4EB] pt-32 pb-20 px-6 relative overflow-hidden" style={{ fontFamily: "'Bryndan Write', 'Kalam', cursive" }}>

      {/* Subtle brand glow for depth */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#DC6835] rounded-full blur-[250px] opacity-[0.07] pointer-events-none translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#1B3629] rounded-full blur-[200px] opacity-[0.05] pointer-events-none -translate-x-1/2 translate-y-1/2" />

      <div className="max-w-7xl mx-auto relative z-10">

        {/* TOP ROW: REFINED VISIT & MAP */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-32 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-[#DC6835] text-[#DC6835] font-bold text-xs tracking-[0.3em] uppercase mb-10 w-fit">
              <MapPin size={16} />
              <span>THE DESTINATION</span>
            </div>

            <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-10 leading-none">
              Visit <br /> <span className="text-[#DC6835]">DONOTDISTURB</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 mb-12">
              <div className="space-y-2">
                <div className="flex items-center gap-2 opacity-40 uppercase font-black tracking-widest text-sm">
                  <Clock size={16} />
                  <span>Door Hours</span>
                </div>
                <p className="text-xl">Mon-Fri: {shopInfo.hours.weekday}</p>
                <p className="text-xl">Sat-Sun: {shopInfo.hours.weekend}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 opacity-40 uppercase font-black tracking-widest text-sm">
                  <MapPin size={16} />
                  <span>The Post</span>
                </div>
                <p className="text-xl leading-snug">{shopInfo.address}</p>
              </div>
            </div>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shopInfo.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-4 px-10 py-5 bg-[#DC6835] text-white font-black text-xl rounded-2xl hover:bg-[#DC6835]/90 transition-all hover:scale-[1.02] active:scale-95 group shadow-[0_20px_40px_rgba(220,104,53,0.2)]"
            >
              <span>GET DIRECTIONS</span>
              <ExternalLink size={20} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>
          </div>

          <div className="h-[500px] rounded-[3rem] overflow-hidden border-2 border-white/5 relative bg-[#111] shadow-2xl">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3960.258179902994!2d110.40710899999999!3d-6.978833199999995!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e708b85cbe263fb%3A0x33e46ec6b85f5d89!2sDo%20Not%20Disturb!5e0!3m2!1sen!2ssg!4v1777114121203!5m2!1sen!2ssg"
              width="100%"
              height="100%"
              style={{ border: 0, filter: "grayscale(1) contrast(1.2) invert(0.9) opacity(0.8)" }}
              allowFullScreen
              loading="lazy"
              className="relative z-0"
            ></iframe>
          </div>
        </div>

        {/* BOTTOM SECTION: ULTRA TIGHT GRID */}
        <div className="max-w-5xl mx-auto border-t border-white/10 pt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_1fr_1.2fr] gap-x-10 gap-y-10">

            {/* Col 1: Brand Soul */}
            <div className="flex flex-col items-center md:items-start">
              <div className="h-40 w-full relative mb-3 group flex items-center justify-center md:justify-start">
                <div className="absolute inset-0 bg-[#DC6835]/10 blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                <svg
                  viewBox="0 0 200 200"
                  className="h-full w-auto filter drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                >
                  {/* Architectural Minimalist Storefront */}
                  <rect x="30" y="65" width="140" height="105" fill="none" stroke="white" strokeWidth="2.5" />
                  <rect x="45" y="95" width="40" height="75" fill="none" stroke="white" strokeWidth="2" />
                  <rect x="100" y="95" width="55" height="45" fill="none" stroke="white" strokeWidth="2" />

                  {/* WIDER Signage to fit COFFEE */}
                  <rect x="15" y="35" width="170" height="30" fill="none" stroke="white" strokeWidth="2.5" />
                  <text
                    x="100"
                    y="56"
                    textAnchor="middle"
                    fill="white"
                    className="font-black text-[15px] uppercase tracking-[0.25em]"
                    style={{ fontFamily: "inherit" }}
                  >
                    DND COFFEE
                  </text>

                  {/* Details */}
                  <line x1="30" y1="170" x2="170" y2="170" stroke="white" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="55" cy="135" r="2" fill="white" />
                  <rect x="110" y="105" width="35" height="25" fill="none" stroke="white" strokeWidth="1" opacity="0.3" />
                </svg>
              </div>
              <h3 className="text-xl font-bold uppercase tracking-widest mb-3">DND COFFEE</h3>
              <p className="opacity-40 leading-relaxed text-[13px] italic pr-4 max-w-[220px]">"Quietly brewing since 2026. Architecting havens for your restless ideas."</p>
            </div>

            {/* Col 2: Navigation */}
            <div>
              <h4 className="text-[#DC6835] font-black uppercase tracking-widest text-xs mb-6">Navigation</h4>
              <ul className="space-y-3 text-base">
                <li><Link href="/" className="hover:text-[#DC6835] transition-colors flex items-center gap-2 group">
                  <span className="w-0 h-0.5 bg-[#DC6835] transition-all group-hover:w-4" />
                  Home
                </Link></li>
                <li><Link href="/activity" className="hover:text-[#DC6835] transition-colors flex items-center gap-2 group">
                  <span className="w-0 h-0.5 bg-[#DC6835] transition-all group-hover:w-4" />
                  Journal
                </Link></li>
                <li><Link href="/album" className="hover:text-[#DC6835] transition-colors flex items-center gap-2 group">
                  <span className="w-0 h-0.5 bg-[#DC6835] transition-all group-hover:w-4" />
                  Album
                </Link></li>
                <li><Link href="/visit" className="hover:text-[#DC6835] transition-colors flex items-center gap-2 group">
                  <span className="w-0 h-0.5 bg-[#DC6835] transition-all group-hover:w-4" />
                  Visit
                </Link></li>
              </ul>
            </div>

            {/* Col 3: Community & Social */}
            <div>
              <h4 className="text-[#DC6835] font-black uppercase tracking-widest text-xs mb-6">Stay Connected</h4>
              <div className="flex gap-3 mb-8">
                {config.socials.map((social, i) => {
                  const platformIcons: Record<string, any> = {
                    Instagram,
                    TikTok: Music,
                    WhatsApp: MessageCircle,
                    Website: Globe
                  };
                  const Icon = platformIcons[social.platform] || Instagram;
                  return (
                    <a key={i} href={social.url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center hover:bg-[#DC6835] hover:border-[#DC6835] transition-all transform hover:-translate-y-1">
                      <Icon size={14} />
                    </a>
                  );
                })}
              </div>
              <h4 className="text-[#DC6835] font-black uppercase tracking-widest text-xs mb-4">Newsletter</h4>
              <div className="relative max-w-[180px]">
                <input
                  type="email"
                  placeholder="Join..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 focus:outline-none focus:border-[#DC6835] transition-colors text-[11px]"
                />
                <button className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square bg-[#DC6835] text-white rounded-lg flex items-center justify-center shadow-lg transform active:scale-90 transition-transform">
                  <Send size={10} />
                </button>
              </div>
            </div>

            {/* Col 4: Reach Us */}
            <div className="space-y-4 lg:text-right flex flex-col lg:items-end">
              <h4 className="text-[#DC6835] font-black uppercase tracking-widest text-xs mb-2">Reach Us</h4>

              <a
                href={`https://wa.me/${shopInfo.phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block group overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all hover:border-[#F9F4EB]/40 hover:scale-[1.02] active:scale-95 w-full max-w-[220px]"
              >
                <div className="py-2 px-4 border-b border-white/5 font-bold text-center text-base">{shopInfo.phone}</div>
                <div className="py-3 px-4 bg-[#F9F4EB] text-black font-black flex items-center justify-center gap-2 text-xs uppercase tracking-tighter">
                  <MessageCircle size={16} />
                  <span>OFFICIAL WHATSAPP</span>
                </div>
              </a>

              <a
                href={`mailto:${shopInfo.email}`}
                className="block group overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all hover:border-[#DC6835]/40 hover:scale-[1.02] active:scale-95 leading-none w-full max-w-[220px]"
              >
                <div className="py-2 px-4 border-b border-white/5 font-bold text-center text-[11px] truncate opacity-60 leading-none h-6 flex items-center justify-center">
                  {shopInfo.email}
                </div>
                <div className="py-3 px-4 bg-[#DC6835] text-white font-black flex items-center justify-center gap-2 text-xs uppercase tracking-tighter leading-none">
                  <FooterFlame size={16} />
                  <span>BULK EVENT ORDER</span>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* BOTTOM LEGAL */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 opacity-30 text-[9px] font-black uppercase tracking-[0.3em]">
          <p>© 2026 {shopInfo.name}. HANDRAISED IN INDONESIA.</p>
          <div className="flex gap-8">
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

const FooterFlame = ({ size }: { size: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.236 1.1-3.1ad1 1 0 0 0 1.9 1c.5 2.52 1.5 3.1 2.5 3.1z" />
  </svg>
)
