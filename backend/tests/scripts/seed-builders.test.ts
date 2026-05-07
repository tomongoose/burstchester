import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { HuggingFaceLocator } from "@/seed/hugging-face-locator";
import { computeSeedKey } from "@/seed/keys";
import { buildSeedDatasetRecord, ADMIN_UID } from "@/seed/build-record";
import { validateSeedManifestEntry } from "@/seed/manifest";
import { validateDatasetUpload } from "@/core/datasets";

const FIXED_NOW = Timestamp.fromDate(new Date("2026-05-05T00:00:00Z"));

const validJsonl =
  '{"messages":[{"role":"user","content":"q1"},{"role":"assistant","content":"a1"}]}\n' +
  '{"messages":[{"role":"user","content":"q2"},{"role":"assistant","content":"a2"}]}\n';

const validRawEntry = {
  huggingFaceId: "burstchester/legal-ko-mini",
  revision: "abc123",
  filePath: "data/train.jsonl",
  title: "Korean Legal Q&A",
  description: "한국 법률 데이터셋",
  tags: ["legal", "korean"],
  language: "ko",
  taskType: "instruction",
  baseModelHint: "qwen3:14b",
  license: "CC-BY-4.0",
  sourceModel: "qwen3:14b",
};

describe("computeSeedKey", () => {
  it("is deterministic for the same locator", () => {
    const locator = HuggingFaceLocator.create("org/name", "abc123");

    expect(computeSeedKey(locator)).toBe(computeSeedKey(locator));
  });

  it("differs when revision changes", () => {
    const a = HuggingFaceLocator.create("org/name", "abc123");
    const b = HuggingFaceLocator.create("org/name", "def456");

    expect(computeSeedKey(a)).not.toBe(computeSeedKey(b));
  });

  it("starts with a `seed-` prefix", () => {
    const locator = HuggingFaceLocator.create("org/name", "abc123");

    expect(computeSeedKey(locator).startsWith("seed-")).toBe(true);
  });
});

describe("buildSeedDatasetRecord", () => {
  function buildEntry() {
    return validateSeedManifestEntry(validRawEntry);
  }
  function buildValidation() {
    return validateDatasetUpload({ content: validJsonl, sourceModel: "qwen3:14b" });
  }

  it("uses the fixed ADMIN_UID as ownerUid", () => {
    const record = buildSeedDatasetRecord(buildEntry(), buildValidation(), FIXED_NOW);

    expect(record.ownerUid).toBe(ADMIN_UID);
  });

  it("adds the `quality:seed` tag", () => {
    const record = buildSeedDatasetRecord(buildEntry(), buildValidation(), FIXED_NOW);

    expect(record.tags).toContain("quality:seed");
  });

  it("uses the provided clock for createdAt and updatedAt", () => {
    const record = buildSeedDatasetRecord(buildEntry(), buildValidation(), FIXED_NOW);

    expect(record.createdAt).toBe(FIXED_NOW);
    expect(record.updatedAt).toBe(FIXED_NOW);
  });

  it("freezes the returned record", () => {
    const record = buildSeedDatasetRecord(buildEntry(), buildValidation(), FIXED_NOW);

    expect(Object.isFrozen(record)).toBe(true);
  });

  it("includes validation stats (rowCount/byteSize/Merkle root) from the validation result", () => {
    const validation = buildValidation();
    const record = buildSeedDatasetRecord(buildEntry(), validation, FIXED_NOW);

    expect(record.rowCount).toBe(validation.rowCount);
    expect(record.byteSize).toBe(validation.byteSize);
    expect(record.sampleHashesMerkleRoot).toBe(validation.sampleHashesMerkleRoot);
  });
});
