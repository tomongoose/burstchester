export interface ModelRecordLike {
  readonly id: string;
  readonly ownerUid: string;
  readonly ownerName: string;
  readonly baseModel: string;
  readonly trainingDatasets: readonly string[];
  readonly trainingMethod: "lora" | "qlora" | "full";
  readonly huggingFaceUrl: string;
  readonly ollamaPullUrl: string | null;
  readonly pointCost: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ModelSummary {
  readonly id: string;
  readonly ownerUid: string;
  readonly ownerName: string;
  readonly ownerLabel: string;
  readonly baseModel: string;
  readonly trainingDatasetCount: number;
  readonly trainingMethod: "lora" | "qlora" | "full";
  readonly huggingFaceUrl: string;
  readonly ollamaPullUrl: string | null;
  readonly pointCost: number;
  readonly updatedAt: string;
}

export function buildModelSummary(record: ModelRecordLike): ModelSummary {
  return Object.freeze({
    id: record.id,
    ownerUid: record.ownerUid,
    ownerName: record.ownerName,
    ownerLabel: buildOwnerLabel(record.ownerUid, record.ownerName),
    baseModel: record.baseModel,
    trainingDatasetCount: Math.max(0, record.trainingDatasets.length),
    trainingMethod: record.trainingMethod,
    huggingFaceUrl: record.huggingFaceUrl,
    ollamaPullUrl: record.ollamaPullUrl,
    pointCost: Math.max(0, record.pointCost),
    updatedAt: record.updatedAt,
  });
}

function buildOwnerLabel(ownerUid: string, ownerName: string): string {
  const trimmedName = ownerName.trim();
  if (!trimmedName) return "Anonymous";
  if (trimmedName === ownerUid || /^[A-Za-z0-9_-]{20,}$/.test(trimmedName)) {
    return "Anonymous";
  }
  return trimmedName;
}
