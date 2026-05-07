import type { Timestamp } from "firebase-admin/firestore";
import { validateDatasetUpload, type DatasetRecord } from "../core/datasets";
import { buildSeedDatasetRecord } from "./build-record";
import { computeSeedKey } from "./keys";
import type { SeedManifestEntry } from "./manifest";

export interface SeedImportDeps {
  readonly fetchJsonl: (url: string) => Promise<string>;
  readonly datasetExists: (seedKey: string) => Promise<boolean>;
  readonly upsertDataset: (record: DatasetRecord) => Promise<void>;
  readonly saveNormalizedText: (path: string, text: string) => Promise<void>;
  readonly clock: () => Timestamp;
}

export interface SeedImportOptions {
  readonly dryRun: boolean;
}

export type SeedImportOutcome = "imported" | "skipped" | "dry-run" | "error";

export interface SeedImportEntryResult {
  readonly seedKey: string;
  readonly outcome: SeedImportOutcome;
  readonly status?: DatasetRecord["status"];
  readonly errorMessage?: string;
}

export interface SeedImportReport {
  readonly results: readonly SeedImportEntryResult[];
}

export async function runSeedImport(
  entries: readonly SeedManifestEntry[],
  deps: SeedImportDeps,
  options: SeedImportOptions,
): Promise<SeedImportReport> {
  const results: SeedImportEntryResult[] = [];
  for (const entry of entries) {
    const seedKey = computeSeedKey(entry.locator);
    const result = await importOne(entry, seedKey, deps, options);
    results.push(result);
  }
  return Object.freeze({ results: Object.freeze(results) });
}

async function importOne(
  entry: SeedManifestEntry,
  seedKey: string,
  deps: SeedImportDeps,
  options: SeedImportOptions,
): Promise<SeedImportEntryResult> {
  if (await deps.datasetExists(seedKey)) {
    return Object.freeze({ seedKey, outcome: "skipped" as const });
  }

  const url = entry.locator.resolveUrl(entry.filePath);
  let content: string;
  try {
    content = await deps.fetchJsonl(url);
  } catch (err) {
    return Object.freeze({
      seedKey,
      outcome: "error" as const,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }

  const validation = validateDatasetUpload({ content, sourceModel: entry.sourceModel });
  const record = buildSeedDatasetRecord(entry, validation, deps.clock());

  if (options.dryRun) {
    return Object.freeze({ seedKey, outcome: "dry-run" as const, status: record.status });
  }

  if (record.normalizedStoragePath) {
    await deps.saveNormalizedText(record.normalizedStoragePath, validation.normalizedJsonl);
  }
  await deps.upsertDataset(record);

  return Object.freeze({ seedKey, outcome: "imported" as const, status: record.status });
}
