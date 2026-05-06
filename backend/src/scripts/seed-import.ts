import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { parseCliArgs } from "../seed/cli-args";
import { validateSeedManifestEntry, type SeedManifestEntryInput } from "../seed/manifest";
import { runSeedImport, type SeedImportDeps } from "../seed/run-import";
import type { DatasetRecord } from "../core/datasets";

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }

  const rawManifest = readFileSync(resolve(args.manifestPath), "utf8");
  const parsed = JSON.parse(rawManifest) as { entries?: SeedManifestEntryInput[] };
  if (!parsed.entries || !Array.isArray(parsed.entries)) {
    throw new Error("manifest must contain an `entries` array");
  }

  const entries = parsed.entries.map(validateSeedManifestEntry);
  const db = getFirestore();
  const bucket = getStorage().bucket();

  const deps: SeedImportDeps = {
    fetchJsonl: async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HF fetch failed: ${res.status} ${res.statusText}`);
      return res.text();
    },
    datasetExists: async (seedKey) => (await db.doc(`datasets/${seedKey}`).get()).exists,
    upsertDataset: async (record: DatasetRecord) => {
      await db.doc(`datasets/${record.id}`).set(record, { merge: true });
    },
    saveNormalizedText: async (path, text) => {
      await bucket.file(path).save(text, { contentType: "application/jsonl" });
    },
    clock: () => Timestamp.now(),
  };

  const report = await runSeedImport(entries, deps, { dryRun: args.dryRun });

  console.log(JSON.stringify(report, null, 2));
  const errors = report.results.filter((r) => r.outcome === "error");
  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("seed-import failed:", err);
  process.exit(1);
});
