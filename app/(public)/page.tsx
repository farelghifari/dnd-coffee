import { HeroSection } from "@/components/public/hero-section"
import { BrandStorySection } from "@/components/public/brand-story-section"
import { MenuStorySection } from "@/components/public/menu-story-section"
import { CommunityHighlightsSection } from "@/components/public/community-highlights-section"
import { VisitInfoSection } from "@/components/public/visit-info-section"
import { InteractiveParallaxSection } from "@/components/public/interactive-parallax-section"

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <BrandStorySection />
      <InteractiveParallaxSection />
      <MenuStorySection />
      <CommunityHighlightsSection />
    </>
  )
}
