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
  const requestKey = [
    sort,
    filter.language ?? "",
    filter.task ?? "",
    filter.baseModel ?? "",
    filter.size ?? "",
    filter.tags.join(","),
  ].join("|");
  const [state, setState] = useState<{
    readonly resolvedKey: string | null;
    readonly summaries: readonly DatasetSummary[];
  }>({
    resolvedKey: null,
    summaries: [],
  });

  useEffect(() => {
    let cancelled = false;

    void fetchDatasetSummaries({ filter, sort })
      .then((next) => {
        if (cancelled) return;
        setState({
          resolvedKey: requestKey,
          summaries: next,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          resolvedKey: requestKey,
          summaries: Object.freeze([]),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [filter, requestKey, sort]);

  return {
    summaries: state.summaries,
    loading: state.resolvedKey !== requestKey,
  };
}
