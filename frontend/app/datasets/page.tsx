"use client";

import { useState } from "react";
import { CategoryFilter } from "@/components/datasets/CategoryFilter";
import { DatasetGrid } from "@/components/datasets/DatasetGrid";
import { SiteNav } from "@/components/site-nav/SiteNav";
import { SiteFooter } from "@/components/site-nav/SiteFooter";
import { SearchFilter } from "@/lib/domain/search-filter";
import { useDatasetSearch } from "@/lib/datasets/use-dataset-search";
import type { SortOrder } from "@/lib/datasets/build-query";

export default function DatasetsPage() {
  const [filter, setFilter] = useState<SearchFilter>(SearchFilter.create({}));
  const [sort, setSort] = useState<SortOrder>("popular");
  const { summaries, loading } = useDatasetSearch(filter, sort);

  return (
    <>
      <SiteNav active="datasets" />
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-container-max px-gutter pt-xl pb-md">
          <div className="flex flex-wrap items-end justify-between gap-md">
            <div>
              <h1 className="font-h1 text-h2 text-on-surface md:text-h1">
                Datasets
              </h1>
              <p className="mt-sm font-body text-body-md text-on-surface-variant">
                Browse community-curated fine-tuning datasets.
              </p>
            </div>
            <SortToggle sort={sort} onChange={setSort} />
          </div>
        </div>

        <div className="mx-auto grid max-w-container-max gap-gutter px-gutter pb-xl lg:grid-cols-[260px_1fr]">
          <CategoryFilter filter={filter} onChange={setFilter} />
          <section className="space-y-md">
            <div className="font-body text-body-md text-on-surface-variant">
              {loading
                ? "Loading datasets…"
                : `Showing ${summaries.length} dataset${summaries.length === 1 ? "" : "s"}`}
            </div>
            {loading ? (
              <ul className="grid list-none gap-gutter sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <li
                    key={idx}
                    className="h-56 animate-pulse rounded-xl border border-outline-variant/30 bg-surface-container-low"
                  />
                ))}
              </ul>
            ) : (
              <DatasetGrid summaries={summaries} />
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function SortToggle({
  sort,
  onChange,
}: {
  readonly sort: SortOrder;
  readonly onChange: (next: SortOrder) => void;
}) {
  const options: readonly { value: SortOrder; label: string }[] = [
    { value: "popular", label: "Most popular" },
    { value: "newest", label: "Most recent" },
  ];
  return (
    <div className="inline-flex rounded-xl border border-outline-variant/30 bg-surface-container p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={sort === opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            "rounded-lg px-4 py-2 font-body text-body-md transition-colors",
            sort === opt.value
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant hover:text-primary",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
