import type { JSX } from "react";
import type { DatasetSummary } from "@/lib/domain/dataset-summary";
import { DatasetCard } from "./DatasetCard";

interface DatasetGridProps {
  readonly summaries: readonly DatasetSummary[];
}

export function DatasetGrid({ summaries }: DatasetGridProps): JSX.Element {
  if (summaries.length === 0) {
    return <p>No datasets found.</p>;
  }
  return (
    <ul aria-label="datasets">
      {summaries.map((summary) => (
        <li key={summary.id}>
          <DatasetCard summary={summary} />
        </li>
      ))}
    </ul>
  );
}
