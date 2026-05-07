"use client";

import type { JSX } from "react";
import Link from "next/link";
import { useDatasetSearch } from "@/lib/datasets/use-dataset-search";
import { SearchFilter } from "@/lib/domain/search-filter";
import { DatasetGrid } from "@/components/datasets/DatasetGrid";

const SEED_TAG = "quality:seed";
const DEFAULT_LIMIT = 4;

export function FeaturedDatasets(): JSX.Element {
  const filter = SearchFilter.create({ tags: [SEED_TAG] });
  const { summaries, loading } = useDatasetSearch(filter, "popular");
  const visible = summaries.slice(0, DEFAULT_LIMIT);

  return (
    <section aria-labelledby="featured-heading">
      <h2 id="featured-heading">Featured seed datasets</h2>
      {loading ? (
        <p>Loading featured datasets…</p>
      ) : visible.length === 0 ? (
        <p>No seed datasets available yet. Check back soon.</p>
      ) : (
        <DatasetGrid summaries={visible} />
      )}
      <Link href="/datasets">See all datasets</Link>
    </section>
  );
}
