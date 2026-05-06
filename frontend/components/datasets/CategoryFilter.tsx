"use client";

import type { JSX } from "react";
import { SearchFilter, type Language, type TaskType } from "@/lib/domain/search-filter";
import type { DatasetSizeCategory } from "@/lib/domain/dataset-size";

const DOMAINS = ["legal", "medical", "finance", "code", "academic", "creative", "gaming"] as const;
const LANGUAGES: readonly Language[] = ["ko", "en", "ja", "multi"];
const TASKS: readonly TaskType[] = ["instruction", "chat", "completion", "tool-use"];
const BASE_MODELS = ["llama3.1:8b", "qwen3:14b", "mistral", "phi4"] as const;
const SIZES: readonly DatasetSizeCategory[] = ["tiny", "small", "medium", "large"];

interface CategoryFilterProps {
  readonly filter: SearchFilter;
  readonly onChange: (next: SearchFilter) => void;
}

export function CategoryFilter({ filter, onChange }: CategoryFilterProps): JSX.Element {
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
    <div>
      <fieldset role="group" aria-label="Domain">
        <legend>Domain</legend>
        {DOMAINS.map((d) => {
          const active = filter.tags.includes(`domain/${d}`);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(withField("tags", toggleTag(filter.tags, `domain/${d}`)))}
            >
              {d}
            </button>
          );
        })}
      </fieldset>

      <fieldset role="group" aria-label="Language">
        <legend>Language</legend>
        {LANGUAGES.map((lang) => {
          const active = filter.language === lang;
          return (
            <button
              key={lang}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(withField("language", active ? null : lang))}
            >
              {lang}
            </button>
          );
        })}
      </fieldset>

      <fieldset role="group" aria-label="Task">
        <legend>Task</legend>
        {TASKS.map((task) => {
          const active = filter.task === task;
          return (
            <button
              key={task}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(withField("task", active ? null : task))}
            >
              {task}
            </button>
          );
        })}
      </fieldset>

      <fieldset role="group" aria-label="Base Model">
        <legend>Base Model</legend>
        {BASE_MODELS.map((model) => {
          const active = filter.baseModel === model;
          return (
            <button
              key={model}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(withField("baseModel", active ? null : model))}
            >
              {model}
            </button>
          );
        })}
      </fieldset>

      <fieldset role="group" aria-label="Size">
        <legend>Size</legend>
        {SIZES.map((s) => {
          const active = filter.size === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(withField("size", active ? null : s))}
            >
              {s}
            </button>
          );
        })}
      </fieldset>
    </div>
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
