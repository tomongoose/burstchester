import { randomUUID } from "node:crypto";

import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import * as functionsV1 from "firebase-functions/v1";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onObjectFinalized } from "firebase-functions/v2/storage";

import { processDatasetUpload, type DatasetRecord } from "./core/datasets";
import { applyDownloadStats, applyLikeWrite, applyReportWrite } from "./core/engagement";
import { buildModelRecord } from "./core/model-registry";
import { prepareDownloadCore } from "./core/packaging";
import { buildUserProfile } from "./core/profiles";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const storage = getStorage();
db.settings({ ignoreUndefinedProperties: true });

type PrepareDownloadResult = Awaited<ReturnType<typeof prepareDownloadCore>>;
type CliProfileRecord = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
};
type GoogleDeviceCodePayload = {
  device_code: string;
  user_code: string;
  verification_url?: string;
  verification_uri?: string;
  interval?: number;
  error?: string;
  error_description?: string;
};
type GoogleTokenPayload = {
  id_token?: string;
  error?: string;
  error_description?: string;
};

export async function healthCheckHandler(
  _request: Request,
  response: Response,
): Promise<void> {
  logger.info("healthCheck invoked");
  response.status(200).json({
    ok: true,
    service: "burstchester-functions",
  });
}

export const healthCheck = onRequest({ region: "us-central1" }, healthCheckHandler);

export const onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
  const profile = buildUserProfile(user);
  await db.doc(`users/${user.uid}`).set(profile, { merge: true });
});

export const onDatasetUpload = onObjectFinalized({ region: "us-central1" }, async (event) => {
  const data = event.data;
  const name = data.name ?? "";

  if (
    !name
    || name.startsWith("normalized/")
    || name.startsWith("downloads/")
    || name.startsWith("debug-uploads/")
  ) {
    return;
  }

  await processDatasetUpload(
    {
      name,
      bucket: data.bucket ?? event.bucket,
      contentType: data.contentType,
      size: data.size,
      metadata: data.metadata,
    },
    {
      downloadObjectText: async (bucket, path) => {
        const [bytes] = await storage.bucket(bucket).file(path).download();
        return bytes.toString("utf8");
      },
      saveNormalizedText: async (path, text, bucket) => {
        await storage.bucket(bucket).file(path).save(text, {
          contentType: "application/jsonl",
        });
      },
      upsertDataset: async (record) => {
        await db.doc(`datasets/${record.id}`).set(stripUndefinedDeep(record), { merge: true });
      },
      incrementUserUploads: async (ownerUid) => {
        await db.doc(`users/${ownerUid}`).set(
          {
            uploadCount: FieldValue.increment(1),
          },
          { merge: true },
        );
      },
    },
  );
});

export const onLikeWrite = onDocumentWritten(
  { region: "us-central1", document: "datasets/{id}/likes/{uid}" },
  async (event) => {
    const beforeExists = event.data?.before.exists ?? false;
    const afterExists = event.data?.after.exists ?? false;
    if (beforeExists === afterExists) {
      return;
    }

    const datasetRef = db.doc(`datasets/${event.params.id}`);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(datasetRef);
      if (!snapshot.exists) {
        return;
      }

      const dataset = snapshot.data() as DatasetRecord;
      const result = applyLikeWrite(dataset, beforeExists, afterExists);

      transaction.update(datasetRef, {
        likeCount: result.dataset.likeCount,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(
        db.doc(`users/${result.owner.uid}`),
        {
          reputation: FieldValue.increment(result.owner.reputationDelta),
        },
        { merge: true },
      );
    });
  },
);

export const onReportWrite = onDocumentWritten(
  { region: "us-central1", document: "datasets/{id}/reports/{uid}" },
  async (event) => {
    const beforeExists = event.data?.before.exists ?? false;
    const afterExists = event.data?.after.exists ?? false;
    if (beforeExists === afterExists) {
      return;
    }

    const datasetRef = db.doc(`datasets/${event.params.id}`);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(datasetRef);
      if (!snapshot.exists) {
        return;
      }

      const dataset = snapshot.data() as DatasetRecord;
      const result = applyReportWrite(dataset, beforeExists, afterExists);

      transaction.update(datasetRef, {
        reportCount: result.dataset.reportCount,
        status: result.dataset.status,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(
        db.doc(`users/${result.owner.uid}`),
        {
          reputation: FieldValue.increment(result.owner.reputationDelta),
        },
        { merge: true },
      );
    });
  },
);

export async function prepareDatasetDownloadHandler(
  request: Pick<Request, "query" | "body">,
  response: Response,
  prepareDownloadRequest: (datasetId: string) => Promise<PrepareDownloadResult> = (datasetId) =>
    executePrepareDownload(datasetId),
): Promise<void> {
  const datasetId = readDatasetId(request);
  if (!datasetId) {
    response.status(400).json({
      ok: false,
      error: "datasetId is required.",
    });
    return;
  }

  try {
    const result = await prepareDownloadRequest(datasetId);
    response.status(200).json({
      ok: true,
      datasetId,
      ...result,
    });
  } catch (error) {
    logger.error("prepareDatasetDownload failed", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Dataset download preparation failed.",
    });
  }
}

export const prepareDatasetDownload = onRequest(
  { region: "us-central1" },
  prepareDatasetDownloadHandler,
);

export async function cliGoogleAuthHandler(
  request: Pick<Request, "headers" | "body">,
  response: Response,
  deps: {
    verifyIdToken: (idToken: string) => Promise<{ uid: string }>;
    startDeviceFlow: () => Promise<{
      device_code: string;
      user_code: string;
      verification_url?: string;
      verification_uri?: string;
      interval?: number;
    }>;
    pollDeviceFlow: (deviceCode: string) => Promise<
      | { status: "pending"; interval?: number }
      | { status: "approved"; idToken: string }
    >;
  } = {
    verifyIdToken: async (idToken) => getAdminAuth().verifyIdToken(idToken),
    startDeviceFlow: startCliGoogleDeviceFlow,
    pollDeviceFlow: pollCliGoogleDeviceFlow,
  },
): Promise<void> {
  const bearerToken = readBearerToken(request);
  if (!bearerToken) {
    response.status(401).json({
      ok: false,
      error: "Missing bearer token.",
    });
    return;
  }

  const action = readStringField(request.body, "action").trim();
  if (action !== "start" && action !== "poll") {
    response.status(400).json({
      ok: false,
      error: "action must be either 'start' or 'poll'.",
    });
    return;
  }

  try {
    await deps.verifyIdToken(bearerToken);

    if (action === "start") {
      const device = await deps.startDeviceFlow();
      response.status(200).json({
        ok: true,
        status: "pending",
        deviceCode: device.device_code,
        userCode: device.user_code,
        verificationUrl: device.verification_url ?? device.verification_uri,
        interval: device.interval ?? 5,
      });
      return;
    }

    const deviceCode = readStringField(request.body, "deviceCode").trim();
    if (!deviceCode) {
      response.status(400).json({
        ok: false,
        error: "deviceCode is required for poll action.",
      });
      return;
    }

    const result = await deps.pollDeviceFlow(deviceCode);
    if (result.status === "pending") {
      response.status(200).json({
        ok: true,
        status: "pending",
        interval: result.interval ?? 5,
      });
      return;
    }

    response.status(200).json({
      ok: true,
      status: "approved",
      idToken: result.idToken,
    });
  } catch (error) {
    logger.error("cliGoogleAuth failed", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "CLI Google auth failed.",
    });
  }
}

export const cliGoogleAuth = onRequest({ region: "us-central1" }, cliGoogleAuthHandler);

export async function debugUploadDatasetHandler(
  request: Pick<Request, "headers" | "body">,
  response: Response,
  deps: {
    verifyIdToken: (idToken: string) => Promise<{ uid: string; email?: string; name?: string }>;
    uploadDataset: (input: {
      ownerUid: string;
      ownerName: string;
      filename: string;
      content: string;
      metadata: Record<string, unknown>;
    }) => Promise<Pick<DatasetRecord, "id" | "status" | "normalizedStoragePath">>;
  } = {
    verifyIdToken: async (idToken) => getAdminAuth().verifyIdToken(idToken),
    uploadDataset: uploadDebugDatasetRecord,
  },
): Promise<void> {
  const bearerToken = readBearerToken(request);
  if (!bearerToken) {
    response.status(401).json({
      ok: false,
      error: "Missing bearer token.",
    });
    return;
  }

  const content = readStringField(request.body, "content");
  if (!content.trim()) {
    response.status(400).json({
      ok: false,
      error: "content is required.",
    });
    return;
  }

  try {
    const decoded = await deps.verifyIdToken(bearerToken);
    const metadata = readRecordField(request.body, "metadata");
    const dataset = await deps.uploadDataset({
      ownerUid: decoded.uid,
      ownerName: decoded.name || decoded.email || decoded.uid,
      filename: resolveDebugFilename(
        readStringField(request.body, "filename"),
        readStringField(request.body, "datasetId"),
      ),
      content,
      metadata: {
        ...metadata,
        datasetId: readStringField(request.body, "datasetId") || metadata.datasetId,
        title: readStringField(request.body, "title") || metadata.title,
        description: readStringField(request.body, "description") || metadata.description,
        tags: readStringField(request.body, "tags") || metadata.tags,
        baseModelHint: readStringField(request.body, "baseModelHint") || metadata.baseModelHint,
        taskType: readStringField(request.body, "taskType") || metadata.taskType,
        language: readStringField(request.body, "language") || metadata.language,
        license: readStringField(request.body, "license") || metadata.license,
        sourceModel: readStringField(request.body, "sourceModel") || metadata.sourceModel,
        outputModelId: readStringField(request.body, "outputModelId") || metadata.outputModelId,
      },
    });

    response.status(200).json({
      ok: true,
      dataset,
    });
  } catch (error) {
    logger.error("debugUploadDataset failed", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Debug dataset upload failed.",
    });
  }
}

export const debugUploadDataset = onRequest({ region: "us-central1" }, debugUploadDatasetHandler);

export async function upsertCliProfileHandler(
  request: Pick<Request, "headers" | "body">,
  response: Response,
  deps: {
    verifyIdToken: (idToken: string) => Promise<{ uid: string; email?: string; name?: string; picture?: string }>;
    upsertProfile: (input: {
      uid: string;
      email?: string;
      displayName: string;
      photoURL?: string | null;
    }) => Promise<CliProfileRecord>;
  } = {
    verifyIdToken: async (idToken) => getAdminAuth().verifyIdToken(idToken),
    upsertProfile: upsertCliProfileRecord,
  },
): Promise<void> {
  const bearerToken = readBearerToken(request);
  if (!bearerToken) {
    response.status(401).json({
      ok: false,
      error: "Missing bearer token.",
    });
    return;
  }

  const displayName = readStringField(request.body, "displayName").trim();
  if (!displayName) {
    response.status(400).json({
      ok: false,
      error: "displayName is required.",
    });
    return;
  }

  try {
    const decoded = await deps.verifyIdToken(bearerToken);
    const profile = await deps.upsertProfile({
      uid: decoded.uid,
      email: decoded.email,
      displayName,
      photoURL: readOptionalStringField(request.body, "photoURL") ?? decoded.picture,
    });

    response.status(200).json({
      ok: true,
      profile,
    });
  } catch (error) {
    logger.error("upsertCliProfile failed", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "CLI profile upsert failed.",
    });
  }
}

export const upsertCliProfile = onRequest({ region: "us-central1" }, upsertCliProfileHandler);

export const prepareDownload = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const datasetId = String(request.data?.datasetId ?? "").trim();
  if (!datasetId) {
    throw new HttpsError("invalid-argument", "datasetId is required.");
  }

  try {
    return await executePrepareDownload(datasetId, request.auth.uid);
  } catch (error) {
    logger.error("prepareDownload failed", error);
    throw new HttpsError("internal", error instanceof Error ? error.message : "Download packaging failed.");
  }
});

export const registerModel = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  try {
    const record = buildModelRecord({
      ownerUid: request.auth.uid,
      huggingFaceUrl: String(request.data?.huggingFaceUrl ?? ""),
      baseModel: typeof request.data?.baseModel === "string" ? request.data.baseModel : undefined,
      trainingDatasets: Array.isArray(request.data?.trainingDatasets)
        ? request.data.trainingDatasets.map((value: unknown) => String(value))
        : undefined,
      trainingMethod: typeof request.data?.trainingMethod === "string" ? request.data.trainingMethod : undefined,
      ollamaPullUrl: typeof request.data?.ollamaPullUrl === "string" ? request.data.ollamaPullUrl : null,
    });

    await db.doc(`models/${record.id}`).set(record);

    return {
      id: record.id,
      ownerUid: record.ownerUid,
      huggingFaceUrl: record.huggingFaceUrl,
    };
  } catch (error) {
    logger.error("registerModel failed", error);
    throw new HttpsError(
      "invalid-argument",
      error instanceof Error ? error.message : "Model registration failed.",
    );
  }
});

function pathFromGsUrl(gsUrl: string): string {
  const match = gsUrl.match(/^gs:\/\/[^/]+\/(.+)$/);
  if (!match) {
    throw new Error(`Unsupported storage path: ${gsUrl}`);
  }

  return match[1];
}

async function upsertCliProfileRecord(input: {
  uid: string;
  email?: string;
  displayName: string;
  photoURL?: string | null;
}): Promise<CliProfileRecord> {
  const ref = db.doc(`users/${input.uid}`);
  const snapshot = await ref.get();
  const existing = snapshot.exists ? (snapshot.data() as Partial<CliProfileRecord>) : null;
  const displayName = input.displayName.trim() || existing?.displayName || "Anonymous";
  const email = (input.email ?? existing?.email ?? "").trim();
  const photoURL = (input.photoURL ?? existing?.photoURL ?? "").trim();

  if (!snapshot.exists) {
    const created = buildUserProfile({
      uid: input.uid,
      displayName,
      email,
      photoURL,
    });
    await ref.set(created, { merge: true });
    return {
      uid: created.uid,
      displayName: created.displayName,
      email: created.email,
      photoURL: created.photoURL,
    };
  }

  await ref.set(
    {
      displayName,
      email,
      photoURL,
    },
    { merge: true },
  );

  return {
    uid: input.uid,
    displayName,
    email,
    photoURL,
  };
}

async function uploadDebugDatasetRecord(input: {
  ownerUid: string;
  ownerName: string;
  filename: string;
  content: string;
  metadata: Record<string, unknown>;
}): Promise<Pick<DatasetRecord, "id" | "status" | "normalizedStoragePath">> {
  const bucket = storage.bucket();
  const datasetId = normalizeDebugDatasetId(
    typeof input.metadata.datasetId === "string" ? input.metadata.datasetId : "",
    input.filename,
  );
  const storagePath = `debug-uploads/${input.ownerUid}/${datasetId}.jsonl`;
  const sourceModel =
    typeof input.metadata.sourceModel === "string" && input.metadata.sourceModel.trim() ?
      input.metadata.sourceModel.trim() :
      "human";

  await bucket.file(storagePath).save(input.content, {
    contentType: "application/jsonl",
  });

  const record = await processDatasetUpload(
    {
      name: storagePath,
      bucket: bucket.name,
      contentType: "application/jsonl",
      size: Buffer.byteLength(input.content, "utf8"),
      metadata: {
        datasetId,
        ownerUid: input.ownerUid,
        ownerName: input.ownerName,
        title:
          typeof input.metadata.title === "string" && input.metadata.title.trim() ?
            input.metadata.title.trim() :
            datasetId,
        description:
          typeof input.metadata.description === "string" ? input.metadata.description.trim() : "",
        tags:
          typeof input.metadata.tags === "string" && input.metadata.tags.trim() ?
            input.metadata.tags.trim() :
            "debug,test",
        baseModelHint:
          typeof input.metadata.baseModelHint === "string" ? input.metadata.baseModelHint.trim() : "",
        taskType:
          typeof input.metadata.taskType === "string" ? input.metadata.taskType.trim() : "instruction",
        language:
          typeof input.metadata.language === "string" && input.metadata.language.trim() ?
            input.metadata.language.trim() :
            "unknown",
        license:
          typeof input.metadata.license === "string" && input.metadata.license.trim() ?
            input.metadata.license.trim() :
            "custom",
        sourceModel,
        sourceConfirmed: "true",
        outputModelId:
          typeof input.metadata.outputModelId === "string" ? input.metadata.outputModelId.trim() : "",
      },
    },
    {
      downloadObjectText: async () => input.content,
      saveNormalizedText: async (path, text, targetBucket) => {
        await storage.bucket(targetBucket).file(path).save(text, {
          contentType: "application/jsonl",
        });
      },
      upsertDataset: async (datasetRecord) => {
        await db.doc(`datasets/${datasetRecord.id}`).set(stripUndefinedDeep(datasetRecord), { merge: true });
      },
      incrementUserUploads: async (ownerUid) => {
        await db.doc(`users/${ownerUid}`).set(
          {
            uploadCount: FieldValue.increment(1),
          },
          { merge: true },
        );
      },
    },
  );

  return {
    id: record.id,
    status: record.status,
    normalizedStoragePath: record.normalizedStoragePath,
  };
}

async function startCliGoogleDeviceFlow(): Promise<GoogleDeviceCodePayload> {
  const clientId = requireEnv("BURSTCHESTER_GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_ID");
  const response = await fetch("https://oauth2.googleapis.com/device/code", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      scope: "openid email profile",
    }),
  });

  const payload = (await response.json()) as GoogleDeviceCodePayload;
  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.error || "Failed to start Google device flow.");
  }

  return payload;
}

async function pollCliGoogleDeviceFlow(deviceCode: string) {
  const clientId = requireEnv("BURSTCHESTER_GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("BURSTCHESTER_GOOGLE_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: deviceCode,
      grant_type: "http://oauth.net/grant_type/device/1.0",
    }),
  });

  const payload = (await response.json()) as GoogleTokenPayload;
  if (response.ok) {
    return {
      status: "approved" as const,
      idToken: String(payload.id_token ?? ""),
    };
  }

  if (payload?.error === "authorization_pending") {
    return {
      status: "pending" as const,
      interval: 5,
    };
  }

  if (payload?.error === "slow_down") {
    return {
      status: "pending" as const,
      interval: 10,
    };
  }

  throw new Error(payload?.error_description || payload?.error || "Google device flow polling failed.");
}

async function executePrepareDownload(
  datasetId: string,
  requesterUid?: string,
): Promise<PrepareDownloadResult> {
  return prepareDownloadCore(
    {
      datasetId,
      requesterUid,
    },
    {
      getDataset: async (id) => {
        const snapshot = await db.doc(`datasets/${id}`).get();
        return snapshot.exists ? (snapshot.data() as DatasetRecord) : null;
      },
      downloadNormalizedJsonl: async (dataset) => {
        const path = dataset.normalizedStoragePath ?? pathFromGsUrl(dataset.storagePath);
        const [bytes] = await storage.bucket().file(path).download();
        return bytes.toString("utf8");
      },
      saveArchive: async (path, bytes) => {
        await storage.bucket().file(path).save(bytes, {
          contentType: "application/zip",
        });
      },
      getSignedUrl: async (path) => {
        const [url] = await storage.bucket().file(path).getSignedUrl({
          action: "read",
          expires: Date.now() + 60 * 60 * 1000,
        });
        return url;
      },
      setZipPath: async (id, zipPath) => {
        await db.doc(`datasets/${id}`).set(
          {
            zipPath,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      },
      incrementDownloadStats: async (dataset) => {
        const result = applyDownloadStats(dataset);
        await db.runTransaction(async (transaction) => {
          transaction.set(
            db.doc(`datasets/${dataset.id}`),
            {
              downloadCount: result.dataset.downloadCount,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          transaction.set(
            db.doc(`users/${result.owner.uid}`),
            {
              downloadCount: FieldValue.increment(result.owner.downloadCountDelta),
            },
            { merge: true },
          );
        });
      },
    },
  );
}

function readDatasetId(request: Pick<Request, "query" | "body">): string {
  const queryDatasetId =
    typeof request.query?.datasetId === "string" ? request.query.datasetId :
      Array.isArray(request.query?.datasetId) ? request.query.datasetId[0] :
        "";
  const bodyDatasetId =
    request.body && typeof request.body === "object" && "datasetId" in request.body ?
      String((request.body as Record<string, unknown>).datasetId ?? "") :
      "";

  return String(bodyDatasetId || queryDatasetId).trim();
}

function readBearerToken(request: Pick<Request, "headers">): string {
  const header = request.headers?.authorization ?? request.headers?.Authorization;
  if (typeof header !== "string") {
    return "";
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function readStringField(body: unknown, field: string): string {
  if (!body || typeof body !== "object" || !(field in body)) {
    return "";
  }

  return String((body as Record<string, unknown>)[field] ?? "");
}

function readOptionalStringField(body: unknown, field: string): string | null {
  const value = readStringField(body, field).trim();
  return value ? value : null;
}

function readRecordField(body: unknown, field: string): Record<string, unknown> {
  if (!body || typeof body !== "object" || !(field in body)) {
    return {};
  }

  const value = (body as Record<string, unknown>)[field];
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value as Record<string, unknown> } : {};
}

function resolveDebugFilename(filename: string, datasetId: string): string {
  const normalized = filename.trim();
  if (normalized) {
    return normalized;
  }

  const fallbackId = datasetId.trim() || `debug-${randomUUID()}`;
  return `${fallbackId}.jsonl`;
}

function normalizeDebugDatasetId(rawDatasetId: string, filename: string): string {
  const normalized = rawDatasetId.trim();
  if (normalized) {
    return normalized;
  }

  const fileName = filename.split("/").at(-1) ?? `debug-${randomUUID()}.jsonl`;
  const stripped = fileName.replace(/\.jsonl$/i, "").trim();
  return stripped || `debug-${randomUUID()}`;
}

function requireEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  throw new Error(`Missing required environment variable: ${names.join(" or ")}`);
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)) as T;
  }

  if (value && typeof value === "object") {
    const cleanedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, stripUndefinedDeep(entry)]);
    return Object.fromEntries(cleanedEntries) as T;
  }

  return value;
}
