import { Timestamp } from "firebase-admin/firestore";
import type { DatasetRecord, ValidationResult } from "../core/datasets";
import type { SeedManifestEntry } from "./manifest";
import { computeSeedKey } from "./keys";

export const ADMIN_UID = "burstchester-seed-admin";
export const SEED_QUALITY_TAG = "quality:seed";

export function buildSeedDatasetRecord(
  entry: SeedManifestEntry,
  validation: ValidationResult,
  now: Timestamp,
): DatasetRecord {
  const seedKey = computeSeedKey(entry.locator);
  const tags = mergeTags(entry.tags, SEED_QUALITY_TAG);
  const normalizedStoragePath =
    validation.status === "rejected" ? null : `normalized/${seedKey}/dataset.jsonl`;

  return Object.freeze({
    id: seedKey,
    ownerUid: ADMIN_UID,
    ownerName: "Burstchester Seed",
    title: entry.title,
    description: entry.description,
    tags,
    baseModelHint: entry.baseModelHint,
    taskType: entry.taskType,
    format: "openai-messages" as const,
    language: entry.language,
    license: entry.license,
    rowCount: validation.rowCount,
    byteSize: validation.byteSize,
    avgUserTokens: validation.avgUserTokens,
    avgAssistantTokens: validation.avgAssistantTokens,
    storagePath: `gs://seed/${seedKey}/source.jsonl`,
    normalizedStoragePath,
    zipPath: null,
    sourceModel: entry.sourceModel,
    sourceModelLicense: validation.sourceModelEvaluation.license,
    sourceConfirmed: true,
    outputModelId: null,
    parentDatasets: [],
    samplingMethod: entry.sourceModel === "human" ? ("human-write" as const) : ("llm-output" as const),
    capabilityTags: [],
    sampleHashesMerkleRoot: validation.sampleHashesMerkleRoot,
    likeCount: 0,
    downloadCount: 0,
    reportCount: 0,
    searchKeywords: [],
    status: validation.status,
    rejectReason: validation.rejectReason,
    createdAt: now,
    updatedAt: now,
  });
}

function mergeTags(tags: readonly string[], extra: string): readonly string[] {
  if (tags.includes(extra)) return Object.freeze([...tags]);
  return Object.freeze([...tags, extra]);
}
