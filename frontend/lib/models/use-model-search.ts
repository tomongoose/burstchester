"use client";

import { useEffect, useState } from "react";
import type { ModelSummary } from "@/lib/domain/model-summary";
import type { SortOrder } from "@/lib/datasets/build-query";
import type { ModelSearchFilter } from "./model-filter";
import { fetchModelSummaries } from "./list-models";

export interface UseModelSearchResult {
  readonly models: readonly ModelSummary[];
  readonly loading: boolean;
}

export function useModelSearch(
  filter: ModelSearchFilter,
  sort: SortOrder,
): UseModelSearchResult {
  const requestKey = [
    sort,
    filter.baseModel ?? "",
    filter.trainingMethod ?? "",
  ].join("|");
  const [state, setState] = useState<{
    readonly resolvedKey: string | null;
    readonly models: readonly ModelSummary[];
  }>({
    resolvedKey: null,
    models: [],
  });

  useEffect(() => {
    let cancelled = false;

    void fetchModelSummaries({ sort, filter })
      .then((next) => {
        if (cancelled) return;
        setState({
          resolvedKey: requestKey,
          models: next,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          resolvedKey: requestKey,
          models: Object.freeze([]),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [filter, requestKey, sort]);

  return {
    models: state.models,
    loading: state.resolvedKey !== requestKey,
  };
}
