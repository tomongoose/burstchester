import type { Metadata } from "next";
import { TERMS_CONTENT } from "@/lib/landing/legal-content";
import { buildTermsPageMetadata } from "@/lib/datasets/seo";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = buildTermsPageMetadata();

export default function TermsPage() {
  return <LegalPage document={TERMS_CONTENT} />;
}
