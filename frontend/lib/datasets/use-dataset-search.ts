"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { buildDatasetQuery, type SortOrder } from "./build-query";
import { buildDatasetSummary, type DatasetSummary } from "@/lib/domain/dataset-summary";
import type { SearchFilter } from "@/lib/domain/search-filter";

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
    const q = buildDatasetQuery(filter, { sort, db: getDb() });
    const unsub = onSnapshot(q, (snapshot) => {
      const next = snapshot.docs.map((doc) => {
        const data = doc.data() as Parameters<typeof buildDatasetSummary>[0];
        return buildDatasetSummary({ ...data, id: doc.id });
      });
      setSummaries(Object.freeze(next));
      setLoading(false);
    });
    return () => unsub();
  }, [filter, sort]);

  return { summaries, loading };
}
