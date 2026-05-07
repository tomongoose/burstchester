import type { Metadata } from "next";
import { TERMS_CONTENT } from "@/lib/landing/legal-content";
import { buildTermsPageMetadata } from "@/lib/datasets/seo";

export const metadata: Metadata = buildTermsPageMetadata();

export default function TermsPage() {
  return (
    <main>
      <h1>{TERMS_CONTENT.title}</h1>
      <p>Last updated: {TERMS_CONTENT.lastUpdated}</p>
      {TERMS_CONTENT.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </main>
  );
}
