import type { JSX } from "react";
import Link from "next/link";

interface SiteNavProps {
  readonly active?: "datasets" | "profile" | null;
}

export function SiteNav({ active = null }: SiteNavProps = {}): JSX.Element {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30">
      <div className="mx-auto flex h-16 w-full max-w-container-max items-center justify-between px-gutter">
        <div className="flex items-center gap-md">
          <Link
            href="/"
            className="flex items-center gap-sm focus-visible:outline-2 focus-visible:outline-primary rounded-md"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-container text-on-primary-container font-h3 text-h3 font-bold">
              B
            </span>
            <span className="font-h3 text-h3 font-bold text-primary tracking-tight">
              Burstchester
            </span>
          </Link>
          <div className="ml-xl hidden md:flex items-center gap-lg">
            <Link
              href="/datasets"
              className={`font-body text-body-md transition-colors hover:text-primary ${
                active === "datasets"
                  ? "text-primary border-b-2 border-primary pb-1"
                  : "text-on-surface-variant"
              }`}
            >
              Datasets
            </Link>
            <a
              href="https://github.com/tomato-data/burstchester"
              target="_blank"
              rel="noreferrer"
              className="font-body text-body-md text-on-surface-variant transition-colors hover:text-primary"
            >
              Docs
            </a>
            <Link
              href="/#how-it-works"
              className="font-body text-body-md text-on-surface-variant transition-colors hover:text-primary"
            >
              How it works
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-md">
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center rounded-xl px-4 py-2 font-body text-body-md text-on-surface-variant transition-colors hover:text-primary"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-xl bg-primary px-6 py-2 font-body text-body-md font-bold text-on-primary transition-transform hover:scale-95"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
