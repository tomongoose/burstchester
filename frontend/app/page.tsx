import type { Metadata } from "next";
import Link from "next/link";
import { Hero } from "@/components/landing/Hero";
import { OnboardingSteps } from "@/components/landing/OnboardingSteps";
import { FeaturedDatasets } from "@/components/landing/FeaturedDatasets";
import { buildLandingPageMetadata } from "@/lib/datasets/seo";

export const metadata: Metadata = buildLandingPageMetadata();

export default function HomePage() {
  return (
    <main>
      <Hero />
      <OnboardingSteps />
      <FeaturedDatasets />
      <footer>
        <Link href="/terms">Terms of Use</Link>
        <span> · </span>
        <Link href="/privacy">Privacy Policy</Link>
      </footer>
    </main>
  );
}
