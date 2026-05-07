import type { JSX } from "react";
import Link from "next/link";

export function Hero(): JSX.Element {
  return (
    <header className="hero-gradient relative overflow-hidden">
      <div className="mx-auto max-w-container-max px-gutter pb-20 pt-28 md:pt-32">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-gutter">
          <div className="space-y-6 lg:col-span-7">
            <h1 className="font-h1 text-[clamp(3rem,6vw,5.3rem)] leading-[0.98] tracking-[-0.04em] text-on-surface">
              Fine-tune locally,
              <br />
              <span className="text-primary">Curated globally.</span>
            </h1>

            <p className="max-w-2xl font-body text-body-lg text-on-surface-variant">
              Burstchester provides the most refined, community-driven datasets
              optimized for local LLMs. Scale your inference with specialized
              training data built for the Ollama ecosystem.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/datasets"
                className="inline-flex items-center rounded bg-primary-container px-8 py-4 font-label text-[11px] font-bold uppercase tracking-[0.24em] text-on-primary-container transition-opacity hover:opacity-90"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center rounded border border-white/20 px-8 py-4 font-label text-[11px] font-bold uppercase tracking-[0.24em] text-on-surface transition-colors hover:bg-white/5"
              >
                View demo
              </Link>
            </div>
          </div>

          <div className="relative lg:col-span-5">
            <div className="overflow-hidden rounded-full border border-white/10 bg-surface-container-high shadow-2xl">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBb8DxiXrPEd_Ge8Wq7WuV7lcJ_rYcYG9Ymie-2NoQNhsNeWrotiMmsWBC4seuqiey9QXgurXMfHkbM6JtZwNNyBj91i3aejm1WfNGCYuk1sy-9HkM_fDiOh1eOkKbQq3RrO7w8-VPHgSrqQThdiy4VuyuJIe_iEmP2weNVRm9cQo1DlMVhE_-2BmXq2rhTPh7BZUeNqIXvlgNliVn5qbmcRyY7pCYjtoDZJB84Yrwu5x0HqZfnRVrPLkE_eKj_LMlvHZvk9hFyYgo"
                alt="Abstract visualization of connected data nodes glowing over a dark background."
                className="aspect-square w-full object-cover grayscale brightness-75 transition duration-1000 hover:grayscale-0"
              />
            </div>
            <div className="absolute -bottom-8 left-0 max-w-[18rem] border-l-4 border-primary-container bg-surface-container px-5 py-4">
              <p className="font-h3 text-h3 italic leading-tight text-on-surface">
                &quot;The new standard for local inference precision.&quot;
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
