import { initializeApp, getApps } from "firebase-admin/app";
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

  if (!name || name.startsWith("normalized/") || name.startsWith("downloads/")) {
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
        await db.doc(`datasets/${record.id}`).set(record, { merge: true });
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

export const prepareDownload = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const datasetId = String(request.data?.datasetId ?? "").trim();
  if (!datasetId) {
    throw new HttpsError("invalid-argument", "datasetId is required.");
  }

  try {
    return await prepareDownloadCore(
      {
        datasetId,
        requesterUid: request.auth.uid,
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
