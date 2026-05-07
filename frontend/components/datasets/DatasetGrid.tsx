import type { JSX } from "react";
import type { DatasetSummary } from "@/lib/domain/dataset-summary";
import { DatasetCard } from "./DatasetCard";

interface DatasetGridProps {
  readonly summaries: readonly DatasetSummary[];
}

export function DatasetGrid({ summaries }: DatasetGridProps): JSX.Element {
  if (summaries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low p-xl text-center font-body text-body-md text-on-surface-variant">
        No datasets found.
      </p>
    );
  }
  return (
    <ul
      aria-label="datasets"
      className="grid list-none gap-gutter sm:grid-cols-2 lg:grid-cols-3"
    >
      {summaries.map((summary) => (
        <li key={summary.id} className="h-full">
          <DatasetCard summary={summary} />
        </li>
      ))}
    </ul>
  );
}
