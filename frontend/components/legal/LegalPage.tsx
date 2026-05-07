import type { JSX } from "react";
import { SiteNav } from "@/components/site-nav/SiteNav";
import { SiteFooter } from "@/components/site-nav/SiteFooter";
import type { LegalDocument } from "@/lib/landing/legal-content";

interface LegalPageProps {
  readonly document: LegalDocument;
}

export function LegalPage({ document }: LegalPageProps): JSX.Element {
  return (
    <>
      <SiteNav />
      <main className="flex-1 pt-16">
        <article className="mx-auto max-w-3xl px-gutter py-xl">
          <header className="mb-xl border-b border-outline-variant/30 pb-lg">
            <h1 className="font-h1 text-h1 text-on-surface">{document.title}</h1>
            <p className="mt-md font-label text-label uppercase tracking-widest text-on-surface-variant">
              Last updated: {document.lastUpdated}
            </p>
          </header>

          <div className="space-y-xl">
            {document.sections.map((section) => (
              <section key={section.heading} className="space-y-md">
                <h2 className="font-h2 text-h3 text-on-surface">
                  {section.heading}
                </h2>
                <p className="font-body text-body-md leading-relaxed text-on-surface-variant">
                  {section.body}
                </p>
              </section>
            ))}
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
