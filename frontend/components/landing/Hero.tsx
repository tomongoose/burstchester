import type { JSX } from "react";
import Link from "next/link";

export function Hero(): JSX.Element {
  return (
    <header className="relative overflow-hidden hero-gradient">
      <div className="mx-auto max-w-container-max px-gutter pt-32 pb-xl">
        <div className="grid items-center gap-xl lg:grid-cols-2">
          <div className="space-y-lg">
            <div className="inline-flex items-center gap-sm rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="font-label text-label uppercase tracking-widest text-primary">
                Community preview
              </span>
            </div>

            <h1 className="font-h1 text-h1 max-w-xl text-on-surface">
              Fine-tuning datasets,{" "}
              <span className="text-primary">ready for Ollama.</span>
            </h1>

            <p className="font-body text-body-lg max-w-lg text-on-surface-variant">
              Discover community-curated LLM datasets, train locally with the
              bundled Colab notebook, and run the result with Ollama in three
              simple steps.
            </p>

            <div className="flex flex-wrap gap-md pt-md">
              <Link
                href="/datasets"
                className="inline-flex items-center gap-sm rounded-xl bg-primary px-xl py-4 font-body text-body-lg font-bold text-on-primary transition-transform hover:-translate-y-0.5"
              >
                <span className="material-symbols-outlined">explore</span>
                Browse datasets
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center rounded-xl border border-outline-variant px-xl py-4 font-body text-body-lg font-bold text-on-surface transition-colors hover:bg-surface-container"
              >
                Sign in to upload
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-md font-mono shadow-2xl">
              <div className="flex items-center gap-xs border-b border-outline-variant/30 pb-sm">
                <span className="h-3 w-3 rounded-full bg-error/70" />
                <span className="h-3 w-3 rounded-full bg-tertiary/70" />
                <span className="h-3 w-3 rounded-full bg-secondary/70" />
                <span className="ml-auto font-label text-label uppercase tracking-widest text-on-surface-variant">
                  ~/burstchester
                </span>
              </div>
              <pre className="mt-sm overflow-x-auto whitespace-pre-wrap break-all font-mono text-code leading-relaxed text-on-surface">
{`$ ollama run burstchester/legal-ko-qlora
> 헌법 1조의 의미를 설명해줘
대한민국은 민주공화국이며, 모든 권력은
국민으로부터 나온다는 원칙입니다…`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
