export type ModelTrainingMethod = "lora" | "qlora" | "full";

export interface ModelRecordLike {
  readonly id: string;
  readonly ownerUid: string;
  readonly title?: string;
  readonly ownerName: string;
  readonly baseModel: string;
  readonly trainingDatasets: readonly string[];
  readonly trainingMethod: ModelTrainingMethod;
  readonly huggingFaceUrl: string;
  readonly ollamaPullUrl: string | null;
  readonly pointCost: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ModelSummary {
  readonly id: string;
  readonly ownerUid: string;
  readonly title: string;
  readonly ownerName: string;
  readonly ownerLabel: string;
  readonly baseModel: string;
  readonly trainingDatasets: readonly string[];
  readonly trainingDatasetCount: number;
  readonly trainingMethod: ModelTrainingMethod;
  readonly huggingFaceUrl: string;
  readonly ollamaPullUrl: string | null;
  readonly pointCost: number;
  readonly updatedAt: string;
}

export function buildModelSummary(record: ModelRecordLike): ModelSummary {
  return Object.freeze({
    id: record.id,
    ownerUid: record.ownerUid,
    title: buildModelTitle(record.title),
    ownerName: record.ownerName,
    ownerLabel: buildOwnerLabel(record.ownerUid, record.ownerName),
    baseModel: record.baseModel,
    trainingDatasets: Object.freeze([...record.trainingDatasets]),
    trainingDatasetCount: Math.max(0, record.trainingDatasets.length),
    trainingMethod: record.trainingMethod,
    huggingFaceUrl: record.huggingFaceUrl,
    ollamaPullUrl: record.ollamaPullUrl,
    pointCost: Math.max(0, record.pointCost),
    updatedAt: record.updatedAt,
  });
}

function buildModelTitle(title: string | undefined): string {
  const trimmed = title?.trim() ?? "";
  return trimmed || "Untitled";
}

function buildOwnerLabel(ownerUid: string, ownerName: string): string {
  const trimmedName = ownerName.trim();
  if (!trimmedName) return "Anonymous";
  if (trimmedName === ownerUid || /^[A-Za-z0-9_-]{20,}$/.test(trimmedName)) {
    return "Anonymous";
  }
  return trimmedName;
}
