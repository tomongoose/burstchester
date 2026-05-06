import type { JSX } from "react";
import Link from "next/link";
import { ONBOARDING_STEPS } from "@/lib/landing/onboarding-steps";

export function OnboardingSteps(): JSX.Element {
  return (
    <section aria-labelledby="onboarding-heading">
      <h2 id="onboarding-heading">How it works</h2>
      <ol>
        {ONBOARDING_STEPS.map((step) => (
          <li key={step.title}>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <Link href={step.ctaUrl}>{step.ctaLabel}</Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
