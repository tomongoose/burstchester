"use client";

import type { JSX } from "react";
import Link from "next/link";
import { useDatasetSearch } from "@/lib/datasets/use-dataset-search";
import { SearchFilter } from "@/lib/domain/search-filter";
import type { DatasetSummary } from "@/lib/domain/dataset-summary";
import { buildDatasetDetailHref } from "@/lib/datasets/routes";

const SEED_TAG = "quality:seed";
const DEFAULT_LIMIT = 6;

export function FeaturedDatasets(): JSX.Element {
  const seedFilter = SearchFilter.create({ tags: [SEED_TAG] });
  const allFilter = SearchFilter.create({});
  const seeded = useDatasetSearch(seedFilter, "popular");
  const fallback = useDatasetSearch(allFilter, "popular");
  const loading = seeded.loading || fallback.loading;
  const summaries = seeded.summaries.length > 0 ? seeded.summaries : fallback.summaries;
  const visible = summaries.slice(0, DEFAULT_LIMIT);

  return (
    <section
      aria-labelledby="featured-heading"
      className="mx-auto max-w-container-max px-gutter py-xl"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-md">
        <div>
          <h2
            id="featured-heading"
            className="font-h2 text-h2 text-on-surface"
          >
            Trending Datasets
          </h2>
          <p className="mt-2 font-body text-body-md text-on-surface-variant">
            Refined by the community for exceptional performance.
          </p>
        </div>
        <Link
          href="/datasets"
          className="inline-flex items-center gap-2 border-b border-primary-container/50 pb-1 font-label text-[11px] uppercase tracking-[0.2em] text-primary-container transition-colors hover:border-primary-container"
        >
          Browse all
        </Link>
      </div>

      {loading ? (
        <FeaturedSkeletons />
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low p-xl text-center font-body text-body-md text-on-surface-variant">
          No datasets available yet. Check back soon.
        </p>
      ) : (
        <FeaturedDatasetBento summaries={visible} />
      )}
    </section>
  );
}

function FeaturedDatasetBento({
  summaries,
}: {
  readonly summaries: readonly DatasetSummary[];
}): JSX.Element {
  const [first, second, third] = summaries;

  return (
    <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
      {first ? <PrimaryFeatureCard summary={first} /> : null}
      {second ? <CompactFeatureCard summary={second} /> : null}
      {third ? <CompactFeatureCard summary={third} /> : null}
      <DeveloperSpotlightCard />
    </div>
  );
}

function PrimaryFeatureCard({
  summary,
}: {
  readonly summary: DatasetSummary;
}): JSX.Element {
  return (
    <Link
      href={buildDatasetDetailHref(summary.id)}
      className="group relative overflow-hidden border border-white/10 bg-surface-container p-8 md:col-span-8"
    >
      <div className="relative z-10">
        <TagRow tags={summary.tags.slice(0, 2)} />
        <h3 className="mt-4 font-h3 text-h3 text-on-surface">{summary.title}</h3>
        <p className="mb-6 mt-2 max-w-2xl font-body text-body-md text-on-surface-variant">
          {summary.description || "No description provided."}
        </p>
        <div className="flex flex-wrap items-center gap-6 text-on-surface-variant">
          <Metric icon="download" value={summary.downloadCount} />
          <Metric icon="favorite" value={summary.likeCount} />
          <span className="font-mono text-code">
            {summary.size.category}
          </span>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-0 right-0 opacity-10 transition-opacity group-hover:opacity-20">
        <span className="material-symbols-outlined text-[12rem] leading-none">
          auto_stories
        </span>
      </div>
    </Link>
  );
}

function CompactFeatureCard({
  summary,
}: {
  readonly summary: DatasetSummary;
}): JSX.Element {
  return (
    <Link
      href={buildDatasetDetailHref(summary.id)}
      className="group flex flex-col justify-between border border-white/10 bg-surface-container p-6 md:col-span-4"
    >
      <div>
        <TagRow tags={summary.tags.slice(0, 1)} />
        <h3 className="mt-4 font-h3 text-h3 text-on-surface">{summary.title}</h3>
        <p className="mt-2 font-body text-body-md text-on-surface-variant">
          {summary.description || "No description provided."}
        </p>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4 text-on-surface-variant">
        <Metric icon="download" value={summary.downloadCount} />
        <span className="material-symbols-outlined text-primary-container transition-transform group-hover:translate-x-1">
          arrow_forward
        </span>
      </div>
    </Link>
  );
}

function DeveloperSpotlightCard(): JSX.Element {
  return (
    <div className="flex items-center justify-between border border-primary-container/20 bg-primary-container/5 p-8 md:col-span-8">
      <div className="max-w-2xl">
        <h3 className="font-h3 text-h3 italic text-primary">
          Developer Spotlight
        </h3>
        <p className="mt-2 font-body text-body-md text-on-surface">
          &quot;Burstchester has cut our R&amp;D cycle for domain-specific models
          by nearly 60% through localized dataset distribution.&quot;
        </p>
        <p className="mt-4 font-label text-[11px] uppercase tracking-[0.22em] text-primary-container">
          — Chief Scientist, Aether AI
        </p>
      </div>
      <span className="material-symbols-outlined hidden text-[4rem] text-primary-container/20 md:block">
        format_quote
      </span>
    </div>
  );
}

function TagRow({ tags }: { readonly tags: readonly string[] }): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-primary-container/50 px-3 py-1 font-label text-[10px] uppercase tracking-[0.2em] text-primary-container"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function Metric({
  icon,
  value,
}: {
  readonly icon: string;
  readonly value: number;
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      <span className="font-mono text-code">{value}</span>
    </span>
  );
}

function FeaturedSkeletons(): JSX.Element {
  return (
    <ul className="grid list-none gap-gutter md:grid-cols-12">
      {Array.from({ length: DEFAULT_LIMIT }).map((_, idx) => (
        <li
          key={idx}
          className={`animate-pulse border border-outline-variant/30 bg-surface-container-low ${
            idx === 0 ? "h-72 md:col-span-8" : "h-56 md:col-span-4"
          }`}
        />
      ))}
    </ul>
  );
}
