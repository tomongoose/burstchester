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
    <footer className="mt-xl w-full border-t border-outline-variant/40 bg-surface-container-lowest py-xl">
      <div className="mx-auto grid max-w-container-max grid-cols-2 gap-gutter px-gutter md:grid-cols-4">
        <div className="col-span-2 space-y-md md:col-span-1">
          <h2 className="font-h2 text-h2 font-bold text-primary">Burstchester</h2>
          <p className="max-w-xs font-body text-body-md text-on-surface-variant">
            Community intelligence for the next generation of local LLMs.
          </p>
          <p className="font-label text-label uppercase tracking-widest text-on-surface-variant/60">
            Made for the Ollama community
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title} className="flex flex-col gap-sm">
            <h5 className="mb-sm font-label text-label font-bold uppercase tracking-widest text-primary">
              {col.title}
            </h5>
            {col.items.map((item) =>
              item.href.startsWith("/") ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="font-body text-body-md text-on-surface-variant transition-all hover:translate-x-1 hover:text-primary"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-body text-body-md text-on-surface-variant transition-all hover:translate-x-1 hover:text-primary"
                >
                  {item.label}
                </a>
              ),
            )}
          </div>
        ))}
      </div>
      <div className="mx-auto mt-xl max-w-container-max border-t border-outline-variant/10 px-gutter pt-lg text-center">
        <p className="font-body text-body-md text-on-surface-variant/60">
          © {year} Burstchester. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
