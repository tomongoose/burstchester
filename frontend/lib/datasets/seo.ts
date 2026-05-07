import type { Metadata } from "next";

export interface DatasetSeoInput {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly ownerName: string;
  readonly tags: readonly string[];
  readonly likeCount: number;
  readonly downloadCount: number;
}

export function buildDatasetMetadata(summary: DatasetSeoInput): Metadata {
  return {
    title: `${summary.title} — Burstchester`,
    description: summary.description,
  };
}

export function buildSearchPageMetadata(): Metadata {
  return {
    title: "Datasets — Burstchester",
    description:
      "Browse curated LLM fine-tuning datasets ready for local Ollama workflows.",
  };
}

export function buildLandingPageMetadata(): Metadata {
  return {
    title: "Burstchester — LLM fine-tuning datasets, ready for Ollama",
    description:
      "Discover, share, and download high-quality fine-tuning datasets from the community. Run them locally with Ollama in three steps.",
  };
}

export function buildTermsPageMetadata(): Metadata {
  return {
    title: "Terms of Use — Burstchester",
    description:
      "Terms of Use governing your access to and use of the Burstchester dataset hub.",
  };
}

export function buildPrivacyPageMetadata(): Metadata {
  return {
    title: "Privacy Policy — Burstchester",
    description:
      "How Burstchester collects, uses, and protects your information when you use the dataset hub.",
  };
}

export interface DatasetJsonLd {
  readonly "@context": "https://schema.org";
  readonly "@type": "Dataset";
  readonly name: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly creator: { readonly "@type": "Person"; readonly name: string };
  readonly url: string;
}

export function buildDatasetJsonLd(summary: DatasetSeoInput): DatasetJsonLd {
  return Object.freeze({
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: summary.title,
    description: summary.description,
    keywords: Object.freeze([...summary.tags]),
    creator: Object.freeze({ "@type": "Person", name: summary.ownerName }),
    url: `https://burstchester.app/datasets/${summary.id}`,
  });
}
