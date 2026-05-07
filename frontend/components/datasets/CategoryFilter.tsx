"use client";

import type { JSX } from "react";
import { SearchFilter, type Language, type TaskType } from "@/lib/domain/search-filter";
import type { DatasetSizeCategory } from "@/lib/domain/dataset-size";

const DOMAINS = [
  "legal",
  "medical",
  "finance",
  "code",
  "academic",
  "creative",
  "gaming",
] as const;
const LANGUAGES: readonly Language[] = ["ko", "en", "ja", "multi"];
const TASKS: readonly TaskType[] = ["instruction", "chat", "completion", "tool-use"];
const BASE_MODELS = ["llama3.1:8b", "qwen3:14b", "mistral", "phi4"] as const;
const SIZES: readonly DatasetSizeCategory[] = ["tiny", "small", "medium", "large"];

interface CategoryFilterProps {
  readonly filter: SearchFilter;
  readonly onChange: (next: SearchFilter) => void;
}

export function CategoryFilter({
  filter,
  onChange,
}: CategoryFilterProps): JSX.Element {
  function withField<K extends keyof SearchFilterPatch>(
    field: K,
    nextValue: SearchFilterPatch[K],
  ): SearchFilter {
    return SearchFilter.create({
      language: filter.language,
      task: filter.task,
      baseModel: filter.baseModel,
      size: filter.size,
      tags: filter.tags,
      [field]: nextValue,
    });
  }

  return (
    <aside className="space-y-lg rounded-xl border border-outline-variant/30 bg-surface-container-low p-lg">
      <FilterSection label="Domain">
        <ChipRow>
          {DOMAINS.map((d) => {
            const active = filter.tags.includes(`domain/${d}`);
            return (
              <Chip
                key={d}
                active={active}
                onClick={() =>
                  onChange(
                    withField("tags", toggleTag(filter.tags, `domain/${d}`)),
                  )
                }
              >
                {d}
              </Chip>
            );
          })}
        </ChipRow>
      </FilterSection>

      <FilterSection label="Language">
        <ChipRow>
          {LANGUAGES.map((lang) => {
            const active = filter.language === lang;
            return (
              <Chip
                key={lang}
                active={active}
                onClick={() => onChange(withField("language", active ? null : lang))}
              >
                {lang}
              </Chip>
            );
          })}
        </ChipRow>
      </FilterSection>

      <FilterSection label="Task">
        <ChipRow>
          {TASKS.map((task) => {
            const active = filter.task === task;
            return (
              <Chip
                key={task}
                active={active}
                onClick={() => onChange(withField("task", active ? null : task))}
              >
                {task}
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
                onClick={() =>
                  onChange(withField("baseModel", active ? null : model))
                }
              >
                {model}
              </Chip>
            );
          })}
        </ChipRow>
      </FilterSection>

      <FilterSection label="Size">
        <ChipRow>
          {SIZES.map((s) => {
            const active = filter.size === s;
            return (
              <Chip
                key={s}
                active={active}
                onClick={() => onChange(withField("size", active ? null : s))}
              >
                {s}
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

interface SearchFilterPatch {
  language: Language | null;
  task: TaskType | null;
  baseModel: string | null;
  size: DatasetSizeCategory | null;
  tags: readonly string[];
}

function toggleTag(tags: readonly string[], tag: string): readonly string[] {
  return tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
}
