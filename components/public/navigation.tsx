"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"

const navItems = [
  { href: "/", label: "Home" },
  { href: "/activity", label: "Journal" },
  { href: "/album", label: "Album" },
  { href: "/visit", label: "Visit" },
]

export function Navigation() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  
  // Check if we're on the home page
  const isHomePage = pathname === "/"

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    // Initial check
    handleScroll()
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Determine visibility: on home page, navbar is hidden until scrolled
  const isVisible = isHomePage ? scrolled : true

  return (
    <header 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out",
        // Visibility and transform for home page only
        isHomePage && !scrolled && "opacity-0 -translate-y-2 pointer-events-none",
        isHomePage && scrolled && "opacity-100 translate-y-0",
        // Non-home pages: always visible
        !isHomePage && "opacity-100 translate-y-0",
        // Background styles
        scrolled || !isHomePage
          ? "bg-[#1C1C1E]/95 backdrop-blur-md border-b border-[#515153]" 
          : "bg-transparent border-b border-transparent"
      )}
    >
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link 
            href="/" 
            className={cn(
              "font-bold text-2xl tracking-tighter transition-all hover:scale-105 active:scale-95"
            )}
          >
            <img 
              src="/images/logo-horizontal-solid-white.png" 
              alt="DONOTDISTURB" 
              className="h-5 w-auto object-contain" 
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <ul className="flex items-center gap-8">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "text-xl font-bold tracking-wide transition-colors",
                      scrolled 
                        ? pathname === item.href
                          ? "text-[#D4A24A]"
                          : "text-[#7A7A7D] hover:text-[#BFC0C2]"
                        : pathname === item.href
                          ? "text-[#D4A24A]"
                          : "text-[#BFC0C2]/70 hover:text-[#BFC0C2]"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Mobile Menu Button */}
          <button
            className={cn(
              "md:hidden p-2 transition-colors",
              "text-[#BFC0C2]"
            )}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-4 pb-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <ul className="space-y-4">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "block text-2xl font-bold tracking-wide transition-colors",
                      pathname === item.href
                        ? "text-[#D4A24A]"
                        : "text-[#7A7A7D] hover:text-[#BFC0C2]"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
    </header>
  )
}
