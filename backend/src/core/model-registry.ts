import { Timestamp } from "firebase-admin/firestore";

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
}

export function validateHuggingFaceDownloadUrl(url: string): { ok: true } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      ok: false,
      reason: "Hugging Face download URL must be a valid URL.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isHuggingFace = hostname === "huggingface.co" || hostname === "hf.co";
  if (!isHuggingFace) {
    return {
      ok: false,
      reason: "Hugging Face download URL must use a Hugging Face domain.",
    };
  }

  const path = parsed.pathname.toLowerCase();
  if (!path.includes("/resolve/") && !path.includes("/download/")) {
    return {
      ok: false,
      reason: "Hugging Face download URL must point to a downloadable file.",
    };
  }

  return { ok: true };
}

export function buildModelRecord(
  input: ModelRegistrationInput,
  idFactory: () => string,
  now: Timestamp,
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

  return Object.freeze({
    id: idFactory(),
    ownerUid,
    baseModel: input.baseModel?.trim() || "unknown",
    trainingDatasets: Array.from(new Set((input.trainingDatasets ?? []).map((value) => value.trim()).filter(Boolean))),
    trainingMethod: normalizeTrainingMethod(input.trainingMethod),
    evalReports: [],
    ollamaPullUrl: input.ollamaPullUrl?.trim() || null,
    huggingFaceUrl,
    createdAt: now,
    updatedAt: now,
  });
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
