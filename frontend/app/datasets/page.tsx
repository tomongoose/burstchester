"use client";

import { useState } from "react";
import { CategoryFilter } from "@/components/datasets/CategoryFilter";
import { DatasetGrid } from "@/components/datasets/DatasetGrid";
import { SearchFilter } from "@/lib/domain/search-filter";
import { useDatasetSearch } from "@/lib/datasets/use-dataset-search";
import type { SortOrder } from "@/lib/datasets/build-query";

export default function DatasetsPage() {
  const [filter, setFilter] = useState<SearchFilter>(SearchFilter.create({}));
  const [sort, setSort] = useState<SortOrder>("popular");
  const { summaries, loading } = useDatasetSearch(filter, sort);

  return (
    <main>
      <h1>Datasets</h1>
      <CategoryFilter filter={filter} onChange={setFilter} />
      <div>
        <button
          type="button"
          aria-pressed={sort === "popular"}
          onClick={() => setSort("popular")}
        >
          Popular
        </button>
        <button
          type="button"
          aria-pressed={sort === "newest"}
          onClick={() => setSort("newest")}
        >
          Newest
        </button>
      </div>
      {loading ? <p>Loading…</p> : <DatasetGrid summaries={summaries} />}
    </main>
  );
}
