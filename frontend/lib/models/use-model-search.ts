"use client";

import { useEffect, useState } from "react";
import type { ModelSummary } from "@/lib/domain/model-summary";
import { fetchModelSummaries } from "./list-models";

export interface UseModelSearchResult {
  readonly models: readonly ModelSummary[];
  readonly loading: boolean;
}

export function useModelSearch(): UseModelSearchResult {
  const requestKey = "newest";
  const [state, setState] = useState<{
    readonly resolvedKey: string | null;
    readonly models: readonly ModelSummary[];
  }>({
    resolvedKey: null,
    models: [],
  });

  useEffect(() => {
    let cancelled = false;

    void fetchModelSummaries({ sort: "newest" })
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
  }, []);

  return {
    models: state.models,
    loading: state.resolvedKey !== requestKey,
  };
}
