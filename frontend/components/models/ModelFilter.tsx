"use client";

import type { JSX } from "react";
import type { ModelTrainingMethod } from "@/lib/domain/model-summary";
import { ModelSearchFilter } from "@/lib/models/model-filter";

const TRAINING_METHODS: readonly ModelTrainingMethod[] = ["lora", "qlora", "full"];
const BASE_MODELS = ["google/gemma-2-2b", "Qwen/Qwen3-0.6B", "google/gemma-3"] as const;

interface ModelFilterProps {
  readonly filter: ModelSearchFilter;
  readonly onChange: (next: ModelSearchFilter) => void;
}

export function ModelFilter({ filter, onChange }: ModelFilterProps): JSX.Element {
  function withField<K extends keyof ModelFilterPatch>(
    field: K,
    nextValue: ModelFilterPatch[K],
  ): ModelSearchFilter {
    return ModelSearchFilter.create({
      baseModel: filter.baseModel,
      trainingMethod: filter.trainingMethod,
      [field]: nextValue,
    });
  }

  return (
    <aside className="space-y-lg rounded-xl border border-outline-variant/30 bg-surface-container-low p-lg">
      <FilterSection label="Training">
        <ChipRow>
          {TRAINING_METHODS.map((method) => {
            const active = filter.trainingMethod === method;
            return (
              <Chip
                key={method}
                active={active}
                onClick={() => onChange(withField("trainingMethod", active ? null : method))}
              >
                {method}
              </Chip>
            );
          })}
        </ChipRow>
      </FilterSection>

      <FilterSection label="Base model">
        <ChipRow>
          {BASE_MODELS.map((model) => {
            const active = filter.baseModel === model;
            return (
              <Chip
                key={model}
                active={active}
                onClick={() => onChange(withField("baseModel", active ? null : model))}
              >
                {model}
              </Chip>
            );
          })}
        </ChipRow>
      </FilterSection>
    </aside>
  );
}

function FilterSection({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}): JSX.Element {
  return (
    <fieldset role="group" aria-label={label} className="space-y-sm">
      <legend className="font-label text-label font-bold uppercase tracking-widest text-primary">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function ChipRow({ children }: { readonly children: React.ReactNode }): JSX.Element {
  return <div className="flex flex-wrap gap-xs pt-xs">{children}</div>;
}

function Chip({
  active,
  children,
  onClick,
}: {
  readonly active: boolean;
  readonly children: React.ReactNode;
  readonly onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "rounded-md px-3 py-1 font-label text-label uppercase tracking-widest transition-colors",
        active
          ? "bg-primary text-on-primary"
          : "bg-surface-variant text-on-surface-variant hover:bg-surface-container-high hover:text-primary",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

interface ModelFilterPatch {
  readonly baseModel: string | null;
  readonly trainingMethod: ModelTrainingMethod | null;
}
