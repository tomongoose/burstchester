import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import {
  DEFAULT_DATASET_DOWNLOAD_POINT_COST,
  DEFAULT_MODEL_DOWNLOAD_POINT_COST,
} from "../core/purchases";

interface BackfillOptions {
  readonly dryRun: boolean;
  readonly projectId: string;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (process.env.FIREBASE_ACCESS_TOKEN) {
    await runRestBackfill(options, process.env.FIREBASE_ACCESS_TOKEN);
    return;
  }

  if (getApps().length === 0) {
    initializeApp();
  }

  const db = getFirestore();
  const datasetUpdates = await backfillCollection({
    collection: "datasets",
    pointCost: DEFAULT_DATASET_DOWNLOAD_POINT_COST,
    dryRun: options.dryRun,
  });
  const modelUpdates = await backfillCollection({
    collection: "models",
    pointCost: DEFAULT_MODEL_DOWNLOAD_POINT_COST,
    dryRun: options.dryRun,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        dryRun: options.dryRun,
        datasetsUpdated: datasetUpdates,
        modelsUpdated: modelUpdates,
      },
      null,
      2,
    )}\n`,
  );

  async function backfillCollection(input: {
    collection: string;
    pointCost: number;
    dryRun: boolean;
  }): Promise<number> {
    const snapshot = await db.collection(input.collection).get();
    let updated = 0;
    let batch = db.batch();
    let pending = 0;

    for (const doc of snapshot.docs) {
      if (typeof doc.data().pointCost === "number") continue;
      updated += 1;
      if (input.dryRun) continue;
      batch.set(doc.ref, { pointCost: input.pointCost }, { merge: true });
      pending += 1;
      if (pending >= 400) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }

    if (!input.dryRun && pending > 0) {
      await batch.commit();
    }
    return updated;
  }
}

function parseArgs(args: string[]): BackfillOptions {
  const projectIndex = args.indexOf("--project");
  return {
    dryRun: args.includes("--dry-run"),
    projectId:
      projectIndex >= 0 && args[projectIndex + 1]
        ? args[projectIndex + 1]
        : process.env.GOOGLE_CLOUD_PROJECT || "bustchester-e08c3",
  };
}

async function runRestBackfill(
  options: BackfillOptions,
  accessToken: string,
): Promise<void> {
  const datasetsUpdated = await backfillRestCollection({
    projectId: options.projectId,
    collection: "datasets",
    pointCost: DEFAULT_DATASET_DOWNLOAD_POINT_COST,
    dryRun: options.dryRun,
    accessToken,
  });
  const modelsUpdated = await backfillRestCollection({
    projectId: options.projectId,
    collection: "models",
    pointCost: DEFAULT_MODEL_DOWNLOAD_POINT_COST,
    dryRun: options.dryRun,
    accessToken,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        dryRun: options.dryRun,
        projectId: options.projectId,
        datasetsUpdated,
        modelsUpdated,
      },
      null,
      2,
    )}\n`,
  );
}

async function backfillRestCollection(input: {
  projectId: string;
  collection: string;
  pointCost: number;
  dryRun: boolean;
  accessToken: string;
}): Promise<number> {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${input.projectId}/databases/(default)/documents/${input.collection}`;
  const listResponse = await fetch(baseUrl, {
    headers: { authorization: `Bearer ${input.accessToken}` },
  });
  if (!listResponse.ok) {
    throw new Error(`Failed to list ${input.collection}: ${listResponse.status} ${await listResponse.text()}`);
  }
  const listPayload = await listResponse.json() as {
    documents?: Array<{ name: string; fields?: Record<string, unknown> }>;
  };

  let updated = 0;
  for (const doc of listPayload.documents ?? []) {
    if (hasIntegerField(doc.fields?.pointCost)) continue;
    updated += 1;
    if (input.dryRun) continue;

    const patchUrl = `https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=pointCost`;
    const patchResponse = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          pointCost: { integerValue: String(input.pointCost) },
        },
      }),
    });
    if (!patchResponse.ok) {
      throw new Error(`Failed to update ${doc.name}: ${patchResponse.status} ${await patchResponse.text()}`);
    }
  }
  return updated;
}

function hasIntegerField(value: unknown): boolean {
  return Boolean(
    value
    && typeof value === "object"
    && "integerValue" in value
    && String((value as { integerValue?: unknown }).integerValue ?? "").trim(),
  );
}

main().catch((error) => {
  console.error("backfill-point-costs failed:", error);
  process.exitCode = 1;
});
