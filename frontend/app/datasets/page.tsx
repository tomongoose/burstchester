"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CategoryFilter } from "@/components/datasets/CategoryFilter";
import { DatasetDetailPanel } from "@/components/datasets/DatasetDetailPanel";
import { DatasetGrid } from "@/components/datasets/DatasetGrid";
import { DatasetSelectionTray } from "@/components/datasets/DatasetSelectionTray";
import { ModelDetailPanel } from "@/components/models/ModelDetailPanel";
import { ModelFilter } from "@/components/models/ModelFilter";
import { ModelGrid } from "@/components/models/ModelGrid";
import { SiteNav } from "@/components/site-nav/SiteNav";
import { SiteFooter } from "@/components/site-nav/SiteFooter";
import { SearchFilter } from "@/lib/domain/search-filter";
import { useDatasetSearch } from "@/lib/datasets/use-dataset-search";
import { useModelSearch } from "@/lib/models/use-model-search";
import { ModelSearchFilter } from "@/lib/models/model-filter";
import type { SortOrder } from "@/lib/datasets/build-query";
import { DATASET_DETAIL_ANCHOR } from "@/lib/datasets/routes";
import { MODEL_DETAIL_ANCHOR } from "@/lib/models/routes";

type ExploreAsset = "datasets" | "models";

export default function DatasetsPage() {
  return (
    <Suspense fallback={<DatasetsPageFallback />}>
      <DatasetsPageContent />
    </Suspense>
  );
}

function DatasetsPageContent() {
  const searchParams = useSearchParams();
  const selectedDatasetId = searchParams.get("dataset") ?? "";
  const selectedModelId = searchParams.get("model") ?? "";
  const initialAsset = searchParams.get("asset") === "models" ? "models" : "datasets";
  const [activeAsset, setActiveAsset] = useState<ExploreAsset>(initialAsset);
  const [filter, setFilter] = useState<SearchFilter>(SearchFilter.create({}));
  const [modelFilter, setModelFilter] = useState<ModelSearchFilter>(
    ModelSearchFilter.create({}),
  );
  const [sort, setSort] = useState<SortOrder>("popular");
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<readonly string[]>(
    [],
  );
  const { summaries, loading } = useDatasetSearch(filter, sort);
  const { models, loading: modelsLoading } = useModelSearch(modelFilter, "newest");
  const detailRef = useRef<HTMLDivElement | null>(null);
  const modelDetailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedDatasetId) return;
    detailRef.current?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [selectedDatasetId]);

  useEffect(() => {
    if (!selectedModelId) return;
    modelDetailRef.current?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [selectedModelId]);

  function handleToggleDatasetSelection(datasetId: string): void {
    setSelectedDatasetIds((current) =>
      current.includes(datasetId)
        ? current.filter((value) => value !== datasetId)
        : [...current, datasetId],
    );
  }

  return (
    <>
      <SiteNav active="datasets" />
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-container-max px-gutter pt-xl pb-md">
          <div className="flex flex-wrap items-end justify-between gap-md">
            <div>
              <h1 className="font-h1 text-h2 text-on-surface md:text-h1">
                Explore
              </h1>
              <p className="mt-sm font-body text-body-md text-on-surface-variant">
                {activeAsset === "datasets"
                  ? "Browse community-curated fine-tuning datasets."
                  : "Browse trained models registered by the community."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-sm">
              <ExploreAssetToggle
                activeAsset={activeAsset}
                onChange={setActiveAsset}
              />
              {activeAsset === "datasets" ? (
                <SortToggle sort={sort} onChange={setSort} />
              ) : null}
            </div>
          </div>
        </div>

        {activeAsset === "datasets" ? (
          <div
            id={DATASET_DETAIL_ANCHOR}
            ref={detailRef}
            className="mx-auto max-w-container-max px-gutter pb-lg"
          >
            {selectedDatasetId ? (
              <DatasetDetailPanel datasetId={selectedDatasetId} />
            ) : null}
          </div>
        ) : null}
        {activeAsset === "models" ? (
          <div
            id={MODEL_DETAIL_ANCHOR}
            ref={modelDetailRef}
            className="mx-auto max-w-container-max px-gutter pb-lg"
          >
            {selectedModelId ? (
              <ModelDetailPanel modelId={selectedModelId} />
            ) : null}
          </div>
        ) : null}

        <div
          className={[
            "mx-auto grid max-w-container-max gap-gutter px-gutter pb-xl",
            "lg:grid-cols-[260px_1fr]",
          ].join(" ")}
        >
          {activeAsset === "datasets" ? (
            <CategoryFilter filter={filter} onChange={setFilter} />
          ) : null}
          {activeAsset === "models" ? (
            <ModelFilter filter={modelFilter} onChange={setModelFilter} />
          ) : null}
          <section className="space-y-md">
            <div className="font-body text-body-md text-on-surface-variant">
              {activeAsset === "datasets"
                ? loading
                  ? "Loading datasets…"
                  : `Showing ${summaries.length} dataset${summaries.length === 1 ? "" : "s"}`
                : modelsLoading
                  ? "Loading models…"
                  : `Showing ${models.length} model${models.length === 1 ? "" : "s"}`}
            </div>
            {activeAsset === "datasets" && loading ? (
              <ul className="grid list-none gap-gutter sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <li
                    key={idx}
                    className="h-56 animate-pulse rounded-xl border border-outline-variant/30 bg-surface-container-low"
                  />
                ))}
              </ul>
            ) : null}
            {activeAsset === "datasets" && !loading ? (
              <DatasetGrid
                summaries={summaries}
                selectedDatasetIds={selectedDatasetIds}
                onToggleSelect={handleToggleDatasetSelection}
              />
            ) : null}
            {activeAsset === "models" && modelsLoading ? (
              <ul className="grid list-none gap-gutter sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <li
                    key={idx}
                    className="h-64 animate-pulse rounded-xl border border-outline-variant/30 bg-surface-container-low"
                  />
                ))}
              </ul>
            ) : null}
            {activeAsset === "models" && !modelsLoading ? (
              <ModelGrid models={models} />
            ) : null}
          </section>
        </div>
      </main>
      {activeAsset === "datasets" ? (
        <DatasetSelectionTray
          selectedDatasetIds={selectedDatasetIds}
          onRemoveDataset={(datasetId) =>
            setSelectedDatasetIds((current) =>
              current.filter((value) => value !== datasetId),
            )
          }
        />
      ) : null}
      <SiteFooter />
    </>
  );
}

function DatasetsPageFallback() {
  return (
    <>
      <SiteNav active="datasets" />
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-container-max px-gutter pt-xl pb-md">
          <div className="h-12 w-56 animate-pulse rounded bg-surface-container-high" />
          <div className="mt-3 h-4 w-80 animate-pulse rounded bg-surface-container" />
        </div>
        <div className="mx-auto grid max-w-container-max gap-gutter px-gutter pb-xl lg:grid-cols-[260px_1fr]">
          <div className="h-64 animate-pulse border border-outline-variant/20 bg-surface-container-low" />
          <div className="space-y-md">
            <div className="h-4 w-48 animate-pulse rounded bg-surface-container" />
            <ul className="grid list-none gap-gutter sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <li
                  key={idx}
                  className="h-56 animate-pulse border border-outline-variant/20 bg-surface-container-low"
                />
              ))}
            </ul>
          </div>
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

function ExploreAssetToggle({
  activeAsset,
  onChange,
}: {
  readonly activeAsset: ExploreAsset;
  readonly onChange: (next: ExploreAsset) => void;
}) {
  const options: readonly { value: ExploreAsset; label: string }[] = [
    { value: "datasets", label: "Datasets" },
    { value: "models", label: "Models" },
  ];
  return (
    <div className="inline-flex rounded-xl border border-outline-variant/30 bg-surface-container p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={activeAsset === opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            "rounded-lg px-4 py-2 font-body text-body-md transition-colors",
            activeAsset === opt.value
              ? "bg-tertiary text-on-tertiary"
              : "text-on-surface-variant hover:text-primary",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
