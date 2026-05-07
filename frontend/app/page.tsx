import type { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { OnboardingSteps } from "@/components/landing/OnboardingSteps";
import { FeaturedDatasets } from "@/components/landing/FeaturedDatasets";
import { SiteNav } from "@/components/site-nav/SiteNav";
import { SiteFooter } from "@/components/site-nav/SiteFooter";
import { buildLandingPageMetadata } from "@/lib/datasets/seo";

export const metadata: Metadata = buildLandingPageMetadata();

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1 pt-16">
        <Hero />
        <OnboardingSteps />
        <FeaturedDatasets />
      </main>
      <SiteFooter />
    </>
  );
}
