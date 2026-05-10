import { initializeApp, getApps } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";

import { INITIAL_USER_POINTS } from "../core/purchases";

interface BackfillOptions {
  readonly dryRun: boolean;
  readonly projectId: string;
}

interface BackfillSummary {
  readonly scanned: number;
  readonly updated: number;
}

const DEFAULT_PROFILE_VALUES = Object.freeze({
  displayName: "Anonymous",
  email: "",
  photoURL: "",
  description: "",
  workplace: "",
  uploadCount: 0,
  downloadCount: 0,
  points: INITIAL_USER_POINTS,
  reputation: 0,
});

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (process.env.FIREBASE_ACCESS_TOKEN) {
    const summary = await runRestBackfill(options, process.env.FIREBASE_ACCESS_TOKEN);
    writeSummary(options, summary);
    return;
  }

  if (getApps().length === 0) {
    initializeApp({ projectId: options.projectId });
  }

  const db = getFirestore();
  const snapshot = await db.collection("users").get();
  let updated = 0;
  let batch = db.batch();
  let pending = 0;

  for (const doc of snapshot.docs) {
    const patch = buildAdminPatch(doc.id, doc.data());
    if (Object.keys(patch).length === 0) continue;
    updated += 1;
    if (options.dryRun) continue;
    batch.set(doc.ref, patch, { merge: true });
    pending += 1;
    if (pending >= 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }

  if (!options.dryRun && pending > 0) {
    await batch.commit();
  }

  writeSummary(options, { scanned: snapshot.size, updated });
}

function buildAdminPatch(
  uid: string,
  data: FirebaseFirestore.DocumentData,
): FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> {
  const patch: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {};
  if (data.uid !== uid) patch.uid = uid;
  if (typeof data.displayName !== "string" || !data.displayName.trim()) {
    patch.displayName = DEFAULT_PROFILE_VALUES.displayName;
  }
  if (typeof data.email !== "string") patch.email = DEFAULT_PROFILE_VALUES.email;
  if (typeof data.photoURL !== "string") patch.photoURL = DEFAULT_PROFILE_VALUES.photoURL;
  if (typeof data.description !== "string") patch.description = DEFAULT_PROFILE_VALUES.description;
  if (typeof data.workplace !== "string") patch.workplace = DEFAULT_PROFILE_VALUES.workplace;
  if (!isTimestampLike(data.createdAt)) patch.createdAt = Timestamp.now();
  if (!Number.isFinite(Number(data.uploadCount))) patch.uploadCount = DEFAULT_PROFILE_VALUES.uploadCount;
  if (!Number.isFinite(Number(data.downloadCount))) patch.downloadCount = DEFAULT_PROFILE_VALUES.downloadCount;
  if (Number(data.points) !== INITIAL_USER_POINTS) patch.points = DEFAULT_PROFILE_VALUES.points;
  if (!Number.isFinite(Number(data.reputation))) patch.reputation = DEFAULT_PROFILE_VALUES.reputation;
  return patch;
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
): Promise<BackfillSummary> {
  let pageToken = "";
  let scanned = 0;
  let updated = 0;

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${options.projectId}/databases/(default)/documents/users`,
    );
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const listResponse = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!listResponse.ok) {
      throw new Error(`Failed to list users: ${listResponse.status} ${await listResponse.text()}`);
    }

    const payload = await listResponse.json() as {
      documents?: RestDocument[];
      nextPageToken?: string;
    };
    for (const doc of payload.documents ?? []) {
      scanned += 1;
      const patch = buildRestPatch(doc);
      if (Object.keys(patch.fields).length === 0) continue;
      updated += 1;
      if (options.dryRun) continue;
      await patchRestDocument(doc.name, patch, accessToken);
    }
    pageToken = payload.nextPageToken ?? "";
  } while (pageToken);

  return { scanned, updated };
}

interface RestDocument {
  readonly name: string;
  readonly fields?: Record<string, RestValue>;
  readonly createTime?: string;
}

interface RestPatch {
  readonly fields: Record<string, RestValue>;
  readonly fieldPaths: readonly string[];
}

type RestValue =
  | { stringValue: string }
  | { integerValue: string }
  | { timestampValue: string };

function buildRestPatch(doc: RestDocument): RestPatch {
  const fields = doc.fields ?? {};
  const uid = doc.name.split("/").pop() ?? "";
  const patch: Record<string, RestValue> = {};

  if (readRestString(fields.uid) !== uid) patch.uid = { stringValue: uid };
  if (!readRestString(fields.displayName)) {
    patch.displayName = { stringValue: DEFAULT_PROFILE_VALUES.displayName };
  }
  if (!hasRestString(fields.email)) patch.email = { stringValue: DEFAULT_PROFILE_VALUES.email };
  if (!hasRestString(fields.photoURL)) patch.photoURL = { stringValue: DEFAULT_PROFILE_VALUES.photoURL };
  if (!hasRestString(fields.description)) patch.description = { stringValue: DEFAULT_PROFILE_VALUES.description };
  if (!hasRestString(fields.workplace)) patch.workplace = { stringValue: DEFAULT_PROFILE_VALUES.workplace };
  if (!fields.createdAt || !("timestampValue" in fields.createdAt)) {
    patch.createdAt = { timestampValue: doc.createTime ?? new Date().toISOString() };
  }
  if (!hasRestInteger(fields.uploadCount)) {
    patch.uploadCount = { integerValue: String(DEFAULT_PROFILE_VALUES.uploadCount) };
  }
  if (!hasRestInteger(fields.downloadCount)) {
    patch.downloadCount = { integerValue: String(DEFAULT_PROFILE_VALUES.downloadCount) };
  }
  if (readRestInteger(fields.points) !== INITIAL_USER_POINTS) {
    patch.points = { integerValue: String(DEFAULT_PROFILE_VALUES.points) };
  }
  if (!hasRestInteger(fields.reputation)) {
    patch.reputation = { integerValue: String(DEFAULT_PROFILE_VALUES.reputation) };
  }

  return { fields: patch, fieldPaths: Object.keys(patch) };
}

async function patchRestDocument(
  documentName: string,
  patch: RestPatch,
  accessToken: string,
): Promise<void> {
  const url = new URL(`https://firestore.googleapis.com/v1/${documentName}`);
  for (const fieldPath of patch.fieldPaths) {
    url.searchParams.append("updateMask.fieldPaths", fieldPath);
  }
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ fields: patch.fields }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update ${documentName}: ${response.status} ${await response.text()}`);
  }
}

function readRestString(value: RestValue | undefined): string {
  return value && "stringValue" in value ? value.stringValue.trim() : "";
}

function hasRestString(value: RestValue | undefined): boolean {
  return Boolean(value && "stringValue" in value);
}

function readRestInteger(value: RestValue | undefined): number | null {
  if (!value || !("integerValue" in value)) return null;
  const parsed = Number(value.integerValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasRestInteger(value: RestValue | undefined): boolean {
  return readRestInteger(value) !== null;
}

function isTimestampLike(value: unknown): boolean {
  return Boolean(
    value
    && typeof value === "object"
    && (
      typeof (value as { toDate?: unknown }).toDate === "function"
      || typeof (value as { toMillis?: unknown }).toMillis === "function"
    ),
  );
}

function writeSummary(options: BackfillOptions, summary: BackfillSummary): void {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        dryRun: options.dryRun,
        projectId: options.projectId,
        ...summary,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  console.error("backfill-user-profiles failed:", error);
  process.exitCode = 1;
});
