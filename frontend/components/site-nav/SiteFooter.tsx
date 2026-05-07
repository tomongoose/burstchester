import type { JSX } from "react";
import Link from "next/link";

const PRODUCT = [
  { label: "Datasets", href: "/datasets" },
  { label: "Get Ollama", href: "https://ollama.com" },
] as const;

const RESOURCES = [
  {
    label: "Colab notebook",
    href: "https://colab.research.google.com/github/burstchester/seed-notebook/blob/main/unsloth_ollama.ipynb",
  },
  { label: "Github", href: "https://github.com/tomato-data/burstchester" },
] as const;

const LEGAL = [
  { label: "Terms of Use", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
] as const;

interface FooterColumn {
  readonly title: string;
  readonly items: readonly { readonly label: string; readonly href: string }[];
}

const COLUMNS: readonly FooterColumn[] = [
  { title: "Product", items: PRODUCT },
  { title: "Resources", items: RESOURCES },
  { title: "Legal", items: LEGAL },
];

export function SiteFooter(): JSX.Element {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-xl w-full border-t border-white/10 bg-surface-container-lowest">
      <div className="mx-auto flex max-w-container-max flex-col gap-gutter px-gutter py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-4">
          <h2 className="font-h1 text-2xl font-semibold text-on-surface">
            Burstchester
          </h2>
          <p className="font-body text-body-md text-on-surface-variant">
            The premier marketplace for artisanal, high-density datasets for
            the local-first AI movement.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-2">
              <h5 className="mb-3 font-label text-[11px] uppercase tracking-[0.22em] text-on-surface">
                {col.title}
              </h5>
              {col.items.map((item) =>
                item.href.startsWith("/") ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="font-body text-body-md text-on-surface-variant transition-colors hover:text-primary"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-body text-body-md text-on-surface-variant transition-colors hover:text-primary"
                  >
                    {item.label}
                  </a>
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-container-max flex-col gap-3 px-gutter py-5 text-[11px] uppercase tracking-[0.2em] text-on-surface-variant md:flex-row md:items-center md:justify-between">
          <span>© {year} Burstchester. All rights reserved.</span>
          <span>Refining local intelligence.</span>
        </div>
      </div>
    </footer>
  );
}
