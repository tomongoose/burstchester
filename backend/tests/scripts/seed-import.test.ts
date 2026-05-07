import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import {
  runSeedImport,
  type SeedImportDeps,
  type SeedImportReport,
} from "@/seed/run-import";
import type { DatasetRecord } from "@/core/datasets";
import type { SeedManifestEntry } from "@/seed/manifest";
import { validateSeedManifestEntry } from "@/seed/manifest";

const FIXED_NOW = Timestamp.fromDate(new Date("2026-05-05T00:00:00Z"));

const validJsonl =
  '{"messages":[{"role":"user","content":"q1"},{"role":"assistant","content":"a1"}]}\n' +
  '{"messages":[{"role":"user","content":"q2"},{"role":"assistant","content":"a2"}]}\n';

const piiJsonl =
  '{"messages":[{"role":"user","content":"contact: alice@example.com"},{"role":"assistant","content":"ok"}]}\n';

function buildEntry(overrides: Partial<{
  huggingFaceId: string;
  revision: string;
  filePath: string;
}> = {}): SeedManifestEntry {
  return validateSeedManifestEntry({
    huggingFaceId: overrides.huggingFaceId ?? "burstchester/legal-ko-mini",
    revision: overrides.revision ?? "abc123",
    filePath: overrides.filePath ?? "data/train.jsonl",
    title: "Korean Legal Q&A",
    description: "한국 법률 데이터셋",
    tags: ["legal"],
    language: "ko",
    taskType: "instruction",
    baseModelHint: "qwen3:14b",
    license: "CC-BY-4.0",
    sourceModel: "qwen3:14b",
  });
}

class SeedImportDepsSpy implements SeedImportDeps {
  readonly upsertedRecords: DatasetRecord[] = [];
  readonly savedFiles: Array<{ path: string; text: string }> = [];
  readonly existing = new Set<string>();
  readonly fetched: string[] = [];
  textByUrl: Record<string, string> = {};
  fetchError: Error | null = null;
  errorOnUrl: string | null = null;

  fetchJsonl = async (url: string): Promise<string> => {
    this.fetched.push(url);
    if (this.errorOnUrl && url === this.errorOnUrl) {
      throw this.fetchError ?? new Error("network");
    }
    return this.textByUrl[url] ?? validJsonl;
  };
  datasetExists = async (seedKey: string): Promise<boolean> => this.existing.has(seedKey);
  upsertDataset = async (record: DatasetRecord): Promise<void> => {
    this.upsertedRecords.push(record);
  };
  saveNormalizedText = async (path: string, text: string): Promise<void> => {
    this.savedFiles.push({ path, text });
  };
  clock = (): Timestamp => FIXED_NOW;
}

describe("runSeedImport", () => {
  it("imports a new entry on the happy path (upsert + saveNormalized)", async () => {
    const spy = new SeedImportDepsSpy();
    const entry = buildEntry();

    const report = await runSeedImport([entry], spy, { dryRun: false });

    expect(spy.upsertedRecords).toHaveLength(1);
    expect(spy.savedFiles).toHaveLength(1);
    expect(spy.upsertedRecords[0].status).toBe("active");
    expect(report.results[0].outcome).toBe("imported");
  });

  it("skips an entry when its seedKey already exists (idempotency)", async () => {
    const spy = new SeedImportDepsSpy();
    const entry = buildEntry();
    const { computeSeedKey } = await import("@/seed/keys");
    spy.existing.add(computeSeedKey(entry.locator));

    const report = await runSeedImport([entry], spy, { dryRun: false });

    expect(spy.upsertedRecords).toEqual([]);
    expect(spy.savedFiles).toEqual([]);
    expect(report.results[0].outcome).toBe("skipped");
  });

  it("marks an entry pending_review when validation flags PII (still upserts metadata, no normalized save)", async () => {
    const spy = new SeedImportDepsSpy();
    const entry = buildEntry();
    spy.textByUrl[entry.locator.resolveUrl(entry.filePath)] = piiJsonl;

    const report = await runSeedImport([entry], spy, { dryRun: false });

    expect(spy.upsertedRecords).toHaveLength(1);
    expect(spy.upsertedRecords[0].status).toBe("pending_review");
    expect(report.results[0].outcome).toBe("imported");
  });

  it("dry-run mode skips both upsertDataset and saveNormalizedText", async () => {
    const spy = new SeedImportDepsSpy();
    const entry = buildEntry();

    const report = await runSeedImport([entry], spy, { dryRun: true });

    expect(spy.upsertedRecords).toEqual([]);
    expect(spy.savedFiles).toEqual([]);
    expect(report.results[0].outcome).toBe("dry-run");
  });

  it("collects one report entry per input entry (3 entries → 3 results)", async () => {
    const spy = new SeedImportDepsSpy();
    const entries = [
      buildEntry({ revision: "v1" }),
      buildEntry({ revision: "v2" }),
      buildEntry({ revision: "v3" }),
    ];

    const report = await runSeedImport(entries, spy, { dryRun: false });

    expect(report.results).toHaveLength(3);
    expect(spy.upsertedRecords).toHaveLength(3);
  });

  it("continues processing after a fetch error on one entry", async () => {
    const spy = new SeedImportDepsSpy();
    const entries = [buildEntry({ revision: "good" }), buildEntry({ revision: "bad" })];
    spy.errorOnUrl = entries[1].locator.resolveUrl(entries[1].filePath);

    const report: SeedImportReport = await runSeedImport(entries, spy, { dryRun: false });

    expect(report.results[0].outcome).toBe("imported");
    expect(report.results[1].outcome).toBe("error");
    expect(spy.upsertedRecords).toHaveLength(1);
  });
});
