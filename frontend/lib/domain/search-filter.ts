import type { DatasetSizeCategory } from "./dataset-size";

export type Language = "ko" | "en" | "ja" | "multi";
export type TaskType = "instruction" | "chat" | "completion" | "tool-use";

const ALLOWED_LANGUAGES: ReadonlySet<Language> = new Set<Language>([
  "ko",
  "en",
  "ja",
  "multi",
]);

const ALLOWED_TASKS: ReadonlySet<TaskType> = new Set<TaskType>([
  "instruction",
  "chat",
  "completion",
  "tool-use",
]);

export interface SearchFilterInput {
  readonly language?: string | null;
  readonly task?: string | null;
  readonly baseModel?: string | null;
  readonly size?: DatasetSizeCategory | null;
  readonly tags?: readonly string[];
}

export class SearchFilter {
  private constructor(
    readonly language: Language | null,
    readonly task: TaskType | null,
    readonly baseModel: string | null,
    readonly size: DatasetSizeCategory | null,
    readonly tags: readonly string[],
  ) {}

  static create(input: SearchFilterInput): SearchFilter {
    const language = normalizeLanguage(input.language);
    const task = normalizeTask(input.task);
    const baseModel = input.baseModel?.trim() || null;
    const size = input.size ?? null;
    const tags = Object.freeze([...(input.tags ?? [])]);
    return Object.freeze(new SearchFilter(language, task, baseModel, size, tags));
  }
}

function normalizeLanguage(value?: string | null): Language | null {
  if (!value) return null;
  if (!ALLOWED_LANGUAGES.has(value as Language)) {
    throw new Error(`Unknown language: ${value}`);
  }
  return value as Language;
}

function normalizeTask(value?: string | null): TaskType | null {
  if (!value) return null;
  if (!ALLOWED_TASKS.has(value as TaskType)) {
    throw new Error(`Unknown task type: ${value}`);
  }
  return value as TaskType;
}
