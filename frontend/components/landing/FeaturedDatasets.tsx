"use client";

import type { JSX } from "react";
import Link from "next/link";
import { useDatasetSearch } from "@/lib/datasets/use-dataset-search";
import { SearchFilter } from "@/lib/domain/search-filter";
import { DatasetGrid } from "@/components/datasets/DatasetGrid";

const SEED_TAG = "quality:seed";
const DEFAULT_LIMIT = 6;

export function FeaturedDatasets(): JSX.Element {
  const filter = SearchFilter.create({ tags: [SEED_TAG] });
  const { summaries, loading } = useDatasetSearch(filter, "popular");
  const visible = summaries.slice(0, DEFAULT_LIMIT);

  return (
    <section
      aria-labelledby="featured-heading"
      className="mx-auto max-w-container-max px-gutter py-xl"
    >
      <div className="mb-xl flex flex-wrap items-end justify-between gap-md">
        <div>
          <h2
            id="featured-heading"
            className="mb-sm font-h2 text-h2 text-on-surface"
          >
            Featured seed datasets
          </h2>
          <p className="font-body text-body-md text-on-surface-variant">
            High-quality, vetted datasets ready for immediate fine-tuning.
          </p>
        </div>
        <Link
          href="/datasets"
          className="inline-flex items-center gap-xs font-body text-body-md font-bold text-primary transition-transform hover:translate-x-1"
        >
          See all datasets
          <span className="material-symbols-outlined text-base">
            arrow_forward
          </span>
        </Link>
      </div>

      {loading ? (
        <FeaturedSkeletons />
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low p-xl text-center font-body text-body-md text-on-surface-variant">
          No seed datasets available yet. Check back soon.
        </p>
      ) : (
        <DatasetGrid summaries={visible} />
      )}
    </section>
  );
}

function FeaturedSkeletons(): JSX.Element {
  return (
    <ul className="grid list-none gap-gutter sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: DEFAULT_LIMIT }).map((_, idx) => (
        <li
          key={idx}
          className="h-56 animate-pulse rounded-xl border border-outline-variant/30 bg-surface-container-low"
        />
      ))}
    </ul>
  );
}
