import type { ModelTrainingMethod } from "@/lib/domain/model-summary";

export interface ModelSearchFilterInput {
  readonly baseModel?: string | null;
  readonly trainingMethod?: string | null;
}

export class ModelSearchFilter {
  private constructor(
    readonly baseModel: string | null,
    readonly trainingMethod: ModelTrainingMethod | null,
  ) {}

  static create(input: ModelSearchFilterInput): ModelSearchFilter {
    return Object.freeze(
      new ModelSearchFilter(
        input.baseModel?.trim() || null,
        normalizeTrainingMethod(input.trainingMethod),
      ),
    );
  }
}

function normalizeTrainingMethod(value?: string | null): ModelTrainingMethod | null {
  if (!value) return null;
  if (value === "lora" || value === "qlora" || value === "full") return value;
  throw new Error(`Unknown model training method: ${value}`);
}
