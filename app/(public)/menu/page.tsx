"use client"

import { MenuStorySection } from "@/components/public/menu-story-section"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function MenuPage() {
  return (
    <main className="min-h-screen bg-[#1C1C1E] pt-0">
      <MenuStorySection />
    </main>
  )
}
