import { Timestamp } from "firebase-admin/firestore";
import { DEFAULT_MODEL_DOWNLOAD_POINT_COST, normalizePointCost } from "./purchases";

export interface ModelEvalReport {
  readonly metric: string;
  readonly score: number;
  readonly dataset?: string;
}

export interface ModelRecord {
  readonly id: string;
  readonly ownerUid: string;
  readonly baseModel: string;
  readonly trainingDatasets: readonly string[];
  readonly trainingMethod: "lora" | "qlora" | "full";
  readonly evalReports: readonly ModelEvalReport[];
  readonly ollamaPullUrl: string | null;
  readonly huggingFaceUrl: string;
  readonly pointCost: number;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface ModelRegistrationInput {
  readonly ownerUid: string;
  readonly huggingFaceUrl: string;
  readonly baseModel?: string;
  readonly trainingDatasets?: readonly string[];
  readonly trainingMethod?: string;
  readonly ollamaPullUrl?: string | null;
  readonly pointCost?: unknown;
}

export interface PaidTrainingAssets {
  readonly paidDatasetIds: readonly string[];
  readonly paidModelNames: readonly string[];
}

export function validateHuggingFaceDownloadUrl(url: string): { ok: true } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      ok: false,
      reason: "Hugging Face URL must be a valid URL.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isHuggingFace = hostname === "huggingface.co" || hostname === "hf.co";
  if (!isHuggingFace) {
    return {
      ok: false,
      reason: "Hugging Face URL must use a Hugging Face domain.",
    };
  }

  const path = parsed.pathname.toLowerCase();
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) {
    return {
      ok: false,
      reason: "Hugging Face URL must point to a model repository or downloadable file.",
    };
  }

  return { ok: true };
}

export function buildModelRecord(
  input: ModelRegistrationInput,
  idFactory: () => string,
  now: Timestamp,
  paidAssets?: PaidTrainingAssets,
): ModelRecord {
  const huggingFaceUrl = input.huggingFaceUrl.trim();
  const urlValidation = validateHuggingFaceDownloadUrl(huggingFaceUrl);
  if (!urlValidation.ok) {
    throw new Error(urlValidation.reason);
  }

  const ownerUid = input.ownerUid.trim();
  if (!ownerUid) {
    throw new Error("ownerUid is required.");
  }

  const baseModel = input.baseModel?.trim() || "unknown";
  const trainingDatasets = Array.from(new Set((input.trainingDatasets ?? []).map((value) => value.trim()).filter(Boolean)));
  validatePaidTrainingAssets({ baseModel, trainingDatasets }, paidAssets);

  return Object.freeze({
    id: idFactory(),
    ownerUid,
    baseModel,
    trainingDatasets,
    trainingMethod: normalizeTrainingMethod(input.trainingMethod),
    evalReports: [],
    ollamaPullUrl: input.ollamaPullUrl?.trim() || null,
    huggingFaceUrl,
    pointCost: normalizePointCost(input.pointCost, DEFAULT_MODEL_DOWNLOAD_POINT_COST),
    createdAt: now,
    updatedAt: now,
  });
}

function validatePaidTrainingAssets(
  input: { baseModel: string; trainingDatasets: readonly string[] },
  paidAssets?: PaidTrainingAssets,
): void {
  if (!paidAssets) return;

  const paidDatasetIds = new Set(paidAssets.paidDatasetIds);
  const unpaidDataset = input.trainingDatasets.find((id) => !paidDatasetIds.has(id));
  if (unpaidDataset) {
    throw new Error(`Training dataset must be paid before registration: ${unpaidDataset}`);
  }

  if (input.baseModel && input.baseModel !== "unknown") {
    const paidModelNames = new Set(paidAssets.paidModelNames);
    if (!paidModelNames.has(input.baseModel)) {
      throw new Error(`Base model must be paid before registration: ${input.baseModel}`);
    }
  }
}

function normalizeTrainingMethod(method?: string): "lora" | "qlora" | "full" {
  switch (method) {
    case "lora":
    case "full":
      return method;
    default:
      return "qlora";
  }
}
