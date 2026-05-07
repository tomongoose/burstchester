export interface OnboardingStep {
  readonly title: string;
  readonly description: string;
  readonly ctaUrl: string;
  readonly ctaLabel: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = Object.freeze([
  Object.freeze({
    title: "1. Find a dataset",
    description:
      "Browse community-curated fine-tuning datasets filtered by domain, language, and base model.",
    ctaUrl: "/datasets",
    ctaLabel: "Browse datasets",
  }),
  Object.freeze({
    title: "2. Train locally",
    description:
      "Open the bundled Colab notebook (Unsloth + LoRA) and produce a quantized GGUF model in one click.",
    ctaUrl: "https://colab.research.google.com/github/burstchester/seed-notebook/blob/main/unsloth_ollama.ipynb",
    ctaLabel: "Open Colab notebook",
  }),
  Object.freeze({
    title: "3. Run with Ollama",
    description:
      "Use the included Modelfile to register your fine-tuned model with Ollama and start chatting locally.",
    ctaUrl: "https://ollama.com",
    ctaLabel: "Get Ollama",
  }),
]);
