import type { JSX } from "react";
import Link from "next/link";

interface SiteNavProps {
  readonly active?: "datasets" | "profile" | "tokens" | null;
}

export function SiteNav({ active = null }: SiteNavProps = {}): JSX.Element {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-background/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-container-max items-center justify-between px-gutter">
        <div className="flex items-center gap-lg">
          <Link
            href="/"
            className="rounded-md text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="font-h1 text-[1.35rem] font-semibold tracking-tight text-on-surface">
              Burstchester
            </span>
          </Link>
          <div className="hidden items-center gap-lg md:flex">
            <Link
              href="/datasets"
              className={`border-b pb-1 font-label text-[11px] uppercase tracking-[0.22em] transition-colors ${
                active === "datasets"
                  ? "border-primary-container text-primary-container"
                  : "border-transparent text-on-surface-variant hover:text-primary"
              }`}
            >
              Explore
            </Link>
            <Link
              href="/access-token"
              className={`border-b pb-1 font-label text-[11px] uppercase tracking-[0.22em] transition-colors ${
                active === "tokens"
                  ? "border-primary-container text-primary-container"
                  : "border-transparent text-on-surface-variant hover:text-primary"
              }`}
            >
              Tokens
            </Link>
            <a
              href="https://github.com/tomato-data/burstchester"
              target="_blank"
              rel="noreferrer"
              className="font-label text-[11px] uppercase tracking-[0.22em] text-on-surface-variant transition-colors hover:text-primary"
            >
              Docs
            </a>
          </div>
        </div>
        <div className="flex items-center gap-sm">
          <Link
            href="/login"
            className="inline-flex items-center rounded-md bg-primary-container px-4 py-2 font-label text-[11px] uppercase tracking-[0.22em] text-on-primary-container transition-opacity hover:opacity-85"
          >
            Sign in
          </Link>
        </div>
      </div>
    </nav>
  );
}
