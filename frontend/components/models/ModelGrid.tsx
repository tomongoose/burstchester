import type { JSX } from "react";
import type { ModelSummary } from "@/lib/domain/model-summary";
import { ModelCard } from "./ModelCard";

interface ModelGridProps {
  readonly models: readonly ModelSummary[];
}

export function ModelGrid({ models }: ModelGridProps): JSX.Element {
  if (models.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-xl font-body text-body-md text-on-surface-variant">
        No models found.
      </div>
    );
  }

  return (
    <ul aria-label="models" className="grid list-none gap-gutter sm:grid-cols-2 lg:grid-cols-3">
      {models.map((model) => (
        <li key={model.id}>
          <ModelCard model={model} />
        </li>
      ))}
    </ul>
  );
}
