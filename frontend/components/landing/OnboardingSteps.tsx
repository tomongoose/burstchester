import type { JSX } from "react";
import Link from "next/link";
import { ONBOARDING_STEPS } from "@/lib/landing/onboarding-steps";

const ICONS = ["search_insights", "model_training", "terminal"] as const;

export function OnboardingSteps(): JSX.Element {
  return (
    <section
      id="how-it-works"
      aria-labelledby="onboarding-heading"
      className="mx-auto max-w-container-max px-gutter py-xl"
    >
      <div className="mb-xl text-center">
        <h2 id="onboarding-heading" className="mb-sm font-h2 text-h2 text-on-surface">
          Dataset to local LLM in minutes
        </h2>
        <p className="mx-auto max-w-2xl font-body text-body-md text-on-surface-variant">
          Burstchester bridges the gap between high-quality community data and
          local execution environments.
        </p>
      </div>

      <ol className="grid list-none gap-lg md:grid-cols-3">
        {ONBOARDING_STEPS.map((step, index) => {
          const indexLabel = String(index + 1).padStart(2, "0");
          const cleanedTitle = step.title.replace(/^\d+\.\s*/, "");
          const icon = ICONS[index] ?? "bolt";
          return (
            <li
              key={step.title}
              className="card-hover-glow rounded-xl border border-outline-variant/30 bg-surface-container p-xl"
            >
              <div className="mb-lg flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container/20 text-primary">
                <span className="font-h3 text-h3">{indexLabel}</span>
              </div>
              <h3 className="mb-md flex items-center gap-sm font-h3 text-h3 text-on-surface">
                <span className="material-symbols-outlined text-primary">
                  {icon}
                </span>
                {cleanedTitle}
              </h3>
              <p className="mb-lg font-body text-body-md text-on-surface-variant">
                {step.description}
              </p>
              <Link
                href={step.ctaUrl}
                className="inline-flex items-center gap-xs font-body text-body-md font-bold text-primary transition-transform hover:translate-x-1"
              >
                {step.ctaLabel}
                <span className="material-symbols-outlined text-base">
                  arrow_forward
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
