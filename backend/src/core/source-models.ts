export type SourceModelDisposition = "allow" | "pending_review" | "reject";

export interface SourceModelEvaluation {
  normalizedSourceModel: string;
  disposition: SourceModelDisposition;
  license:
    | "apache-2.0"
    | "mit"
    | "llama-community"
    | "gemma-tou"
    | "human"
    | "other";
  reason?: string;
}

const ALLOW_RULES: Array<{ match: RegExp; license: SourceModelEvaluation["license"] }> = [
  { match: /\bqwen(?:\s|[-_.:]|\d)/i, license: "apache-2.0" },
  { match: /\bmistral(?:\s|[-_.:]|\d)/i, license: "apache-2.0" },
  { match: /\bmixtral\b/i, license: "apache-2.0" },
  { match: /\bdeepseek\b/i, license: "mit" },
  { match: /\bphi(?:\s|[-_.:]|\d)/i, license: "mit" },
  { match: /\bolmo\b/i, license: "apache-2.0" },
  { match: /\bpythia\b/i, license: "apache-2.0" },
  { match: /\bgpt-neox\b/i, license: "apache-2.0" },
  { match: /\bsmollm\b/i, license: "apache-2.0" },
  { match: /\bfalcon\b/i, license: "apache-2.0" },
  { match: /\byi(?:\s|[-_.:]|\d)/i, license: "apache-2.0" },
  { match: /^human$/i, license: "human" },
];

const CONDITIONAL_RULES: Array<{ match: RegExp; license: SourceModelEvaluation["license"] }> = [
  { match: /\bllama(?:\s|[-_.:]|\d)/i, license: "llama-community" },
  { match: /\bgemma(?:\s|[-_.:]|\d)/i, license: "gemma-tou" },
];

const REJECT_RULES: Array<{ match: RegExp; reason: string }> = [
  { match: /\bgpt(?:-|_|\s)?\d|\bo\d|\bopenai\b|\bchatgpt\b/i, reason: "OpenAI outputs cannot be used for competing model training." },
  { match: /\banthropic\b|\bclaude\b/i, reason: "Anthropic Claude outputs cannot be used for competing model training." },
  { match: /\bgemini\b/i, reason: "Google Gemini outputs are disallowed for model-training reuse." },
  { match: /\bgrok\b|\bxai\b/i, reason: "xAI Grok outputs cannot be used for model training." },
  { match: /\bmistral\s*(large|medium)\b/i, reason: "Closed Mistral API outputs are not allowed." },
  { match: /\bcohere\b|\bcommand\s*r\b/i, reason: "Cohere Command outputs are not allowed." },
];

export function evaluateSourceModel(sourceModel: string): SourceModelEvaluation {
  const normalized = sourceModel.trim().toLowerCase();

  for (const rule of REJECT_RULES) {
    if (rule.match.test(normalized)) {
      return {
        normalizedSourceModel: normalized,
        disposition: "reject",
        license: "other",
        reason: rule.reason,
      };
    }
  }

  for (const rule of ALLOW_RULES) {
    if (rule.match.test(normalized)) {
      return {
        normalizedSourceModel: normalized,
        disposition: "allow",
        license: rule.license,
      };
    }
  }

  for (const rule of CONDITIONAL_RULES) {
    if (rule.match.test(normalized)) {
      return {
        normalizedSourceModel: normalized,
        disposition: "allow",
        license: rule.license,
      };
    }
  }

  return {
    normalizedSourceModel: normalized,
    disposition: "pending_review",
    license: "other",
    reason: "Unknown source model requires manual review.",
  };
}
