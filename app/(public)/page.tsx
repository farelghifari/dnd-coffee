import { HeroSection } from "@/components/public/hero-section"
import { BrandStorySection } from "@/components/public/brand-story-section"
import { FeaturedActivitiesSection } from "@/components/public/featured-activities-section"
import { CommunityHighlightsSection } from "@/components/public/community-highlights-section"
import { VisitInfoSection } from "@/components/public/visit-info-section"

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <BrandStorySection />
      <FeaturedActivitiesSection />
      <CommunityHighlightsSection />
      <VisitInfoSection />
    </>
  )
}
