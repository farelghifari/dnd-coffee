"use client"

import { Navigation } from "@/components/public/navigation"
import { Footer } from "@/components/public/footer"
import { usePathname } from "next/navigation"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLinksPage = pathname === "/links"

  return (
    <>
      {!isLinksPage && <Navigation />}
      <main className="min-h-screen">
        {children}
      </main>
      {!isLinksPage && <Footer />}
    </>
  )
}
