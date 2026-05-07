import type { Metadata } from "next";
import { PRIVACY_CONTENT } from "@/lib/landing/legal-content";
import { buildPrivacyPageMetadata } from "@/lib/datasets/seo";

export const metadata: Metadata = buildPrivacyPageMetadata();

export default function PrivacyPage() {
  return (
    <main>
      <h1>{PRIVACY_CONTENT.title}</h1>
      <p>Last updated: {PRIVACY_CONTENT.lastUpdated}</p>
      {PRIVACY_CONTENT.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </main>
  );
}
