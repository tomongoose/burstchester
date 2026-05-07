"use client";

import { useEffect, useState } from "react";
import type { DatasetSummary } from "@/lib/domain/dataset-summary";
import type { SearchFilter } from "@/lib/domain/search-filter";
import { fetchDatasetSummaries } from "./list-datasets";
import type { SortOrder } from "./build-query";

export interface UseDatasetSearchResult {
  readonly summaries: readonly DatasetSummary[];
  readonly loading: boolean;
}

export function useDatasetSearch(
  filter: SearchFilter,
  sort: SortOrder,
): UseDatasetSearchResult {
  const [summaries, setSummaries] = useState<readonly DatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void fetchDatasetSummaries({ filter, sort })
      .then((next) => {
        if (cancelled) return;
        setSummaries(next);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSummaries(Object.freeze([]));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter, sort]);

  return { summaries, loading };
}
