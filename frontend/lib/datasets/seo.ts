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
