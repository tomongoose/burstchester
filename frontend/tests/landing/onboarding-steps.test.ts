import { describe, expect, it } from "vitest";
import { ONBOARDING_STEPS } from "@/lib/landing/onboarding-steps";

describe("ONBOARDING_STEPS", () => {
  it("contains exactly three entries", () => {
    expect(ONBOARDING_STEPS).toHaveLength(3);
  });

  it("is frozen at the array level", () => {
    expect(Object.isFrozen(ONBOARDING_STEPS)).toBe(true);
  });

  it("each entry has non-empty title, description, ctaUrl, ctaLabel", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
      expect(step.ctaUrl.length).toBeGreaterThan(0);
      expect(step.ctaLabel.length).toBeGreaterThan(0);
    }
  });
});
