import { evaluateSourceModel } from "../core/source-models";
import { HuggingFaceLocator } from "./hugging-face-locator";

export type SeedTaskType = "instruction" | "chat" | "completion" | "tool-use";

const ALLOWED_TASK_TYPES: ReadonlySet<SeedTaskType> = new Set<SeedTaskType>([
  "instruction",
  "chat",
  "completion",
  "tool-use",
]);

export interface SeedManifestEntryInput {
  readonly huggingFaceId?: unknown;
  readonly revision?: unknown;
  readonly filePath?: unknown;
  readonly title?: unknown;
  readonly description?: unknown;
  readonly tags?: unknown;
  readonly language?: unknown;
  readonly taskType?: unknown;
  readonly baseModelHint?: unknown;
  readonly license?: unknown;
  readonly sourceModel?: unknown;
}

export interface SeedManifestEntry {
  readonly locator: HuggingFaceLocator;
  readonly filePath: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly language: string;
  readonly taskType: SeedTaskType;
  readonly baseModelHint: string;
  readonly license: string;
  readonly sourceModel: string;
}

export function validateSeedManifestEntry(input: SeedManifestEntryInput): SeedManifestEntry {
  const huggingFaceId = requireString(input.huggingFaceId, "huggingFaceId");
  const revision = requireString(input.revision, "revision");
  const locator = HuggingFaceLocator.create(huggingFaceId, revision);

  const filePath = requireString(input.filePath, "filePath");
  if (!filePath.endsWith(".jsonl")) {
    throw new Error(`filePath must end with .jsonl (got: ${filePath})`);
  }

  const title = requireString(input.title, "title");
  const taskType = requireString(input.taskType, "taskType");
  if (!ALLOWED_TASK_TYPES.has(taskType as SeedTaskType)) {
    throw new Error(`Unknown taskType: ${taskType}`);
  }

  const sourceModel = requireString(input.sourceModel, "sourceModel");
  const evaluation = evaluateSourceModel(sourceModel);
  if (evaluation.disposition === "reject") {
    throw new Error(`Blacklisted source model: ${sourceModel} (${evaluation.reason})`);
  }

  return Object.freeze({
    locator,
    filePath,
    title,
    description: typeof input.description === "string" ? input.description : "",
    tags: Object.freeze(asStringArray(input.tags)),
    language: typeof input.language === "string" ? input.language : "unknown",
    taskType: taskType as SeedTaskType,
    baseModelHint: typeof input.baseModelHint === "string" ? input.baseModelHint : "",
    license: typeof input.license === "string" ? input.license : "custom",
    sourceModel,
  });
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required and must be a non-empty string`);
  }
  return value.trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}
