import type { JSX } from "react";
import Link from "next/link";
import { ONBOARDING_STEPS } from "@/lib/landing/onboarding-steps";

const ICONS = ["search_insights", "model_training", "terminal"] as const;

export function OnboardingSteps(): JSX.Element {
  return (
    <section
      id="how-it-works"
      aria-labelledby="onboarding-heading"
      className="border-y border-white/5 bg-surface-container-lowest py-xl"
    >
      <div className="mx-auto max-w-container-max px-gutter">
        <ol className="grid list-none gap-gutter md:grid-cols-3">
        {ONBOARDING_STEPS.map((step, index) => {
          const indexLabel = String(index + 1).padStart(2, "0");
          const cleanedTitle = step.title.replace(/^\d+\.\s*/, "");
          const icon = ICONS[index] ?? "bolt";
          return (
            <li
              key={step.title}
              className="card-hover-glow border border-white/10 p-8"
            >
              <span className="material-symbols-outlined mb-6 block text-[40px] text-primary-container">
                {icon}
              </span>
              <h3 className="mb-2 font-h3 text-h3 text-on-surface">
                {indexLabel}. {cleanedTitle}
              </h3>
              <p className="font-body text-body-md text-on-surface-variant">
                {step.description}
              </p>
              <Link
                href={step.ctaUrl}
                className="mt-6 inline-flex items-center gap-2 font-label text-[11px] uppercase tracking-[0.2em] text-primary transition-transform hover:translate-x-1"
              >
                Learn more
                <span className="material-symbols-outlined text-base">
                  arrow_forward
                </span>
              </Link>
            </li>
          );
        })}
        </ol>
      </div>
    </section>
  );
}
