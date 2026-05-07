import type { Metadata } from "next";
import { PRIVACY_CONTENT } from "@/lib/landing/legal-content";
import { buildPrivacyPageMetadata } from "@/lib/datasets/seo";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = buildPrivacyPageMetadata();

export default function PrivacyPage() {
  return <LegalPage document={PRIVACY_CONTENT} />;
}
