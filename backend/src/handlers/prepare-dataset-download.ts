import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import type { DatasetRecord } from "../core/datasets";
import { applyDownloadStats } from "../core/engagement";
import { prepareDownloadCore } from "../core/packaging";
import {
  DEFAULT_DATASET_DOWNLOAD_POINT_COST,
  INITIAL_USER_POINTS,
  applyPointCharge,
  normalizePointCost,
  paidDatasetPath,
  type PointChargeResult,
} from "../core/purchases";
import type { HandlerDeps } from "./deps";
import { pathFromGsUrl, readBearerToken, readDatasetId } from "./_request-helpers";

type PrepareDownloadResult = Awaited<ReturnType<typeof prepareDownloadCore>>;

export function createPrepareDatasetDownloadHandler(
  deps: Pick<HandlerDeps, "auth" | "database" | "db" | "storage" | "fieldValue">,
) {
  return async function handlePrepareDatasetDownload(
    request: Pick<Request, "headers" | "query" | "body">,
    response: Response,
    prepareDownloadRequest: (
      datasetId: string,
      requesterUid: string,
    ) => Promise<PrepareDownloadResult> = (datasetId, requesterUid) =>
      executePrepareDownload(deps, datasetId, requesterUid),
    verifyIdToken?: HandlerDeps["auth"]["verifyIdToken"],
  ): Promise<void> {
    applyCors(response);
    const datasetId = readDatasetId(request);
    if (!datasetId) {
      response.status(400).json({
        ok: false,
        error: "datasetId is required.",
      });
      return;
    }

    const bearerToken = readBearerToken(request);
    if (!bearerToken) {
      response.status(401).json({ ok: false, error: "Missing bearer token." });
      return;
    }

    try {
      const decoded = await (verifyIdToken ?? deps.auth.verifyIdToken)(bearerToken);
      const result = await prepareDownloadRequest(datasetId, decoded.uid);
      response.status(200).json({
        ok: true,
        datasetId,
        ...result,
      });
    } catch (error) {
      logger.error("prepareDatasetDownload failed", error);
      response.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Dataset download preparation failed.",
      });
    }
  };
}

export function createPrepareDatasetDownload(
  deps: Pick<HandlerDeps, "auth" | "database" | "db" | "storage" | "fieldValue">,
) {
  const handler = createPrepareDatasetDownloadHandler(deps);
  return onRequest({ region: "us-central1" }, (request, response) =>
    handler(request, response),
  );
}

export async function executePrepareDownload(
  deps: Pick<HandlerDeps, "database" | "db" | "storage" | "fieldValue">,
  datasetId: string,
  requesterUid?: string,
): Promise<PrepareDownloadResult & Partial<PointChargeResult>> {
  const now = new Date();
  const signedUrlExpiresAt = now.getTime() + 60 * 60 * 1000;
  let pointCharge: PointChargeResult | undefined;
  const result = await prepareDownloadCore(
    {
      datasetId,
      requesterUid,
    },
    {
      getDataset: async (id) => {
        const snapshot = await deps.db.doc(`datasets/${id}`).get();
        return snapshot.exists ? (snapshot.data() as DatasetRecord) : null;
      },
      downloadNormalizedJsonl: async (dataset) => {
        const path =
          dataset.normalizedStoragePath ?? pathFromGsUrl(dataset.storagePath);
        const [bytes] = await deps.storage.bucket().file(path).download();
        return bytes.toString("utf8");
      },
      saveArchive: async (path, bytes) => {
        await deps.storage.bucket().file(path).save(bytes, {
          contentType: "application/zip",
        });
      },
      getSignedUrl: async (path, filename) => {
        const [url] = await deps.storage.bucket().file(path).getSignedUrl({
          action: "read",
          expires: signedUrlExpiresAt,
          responseDisposition: `attachment; filename="${filename}"`,
        });
        return url;
      },
      setZipPath: async (id, zipPath) => {
        await deps.db.doc(`datasets/${id}`).set(
          {
            zipPath,
            updatedAt: deps.fieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      },
      incrementDownloadStats: async (dataset) => {
        const result = applyDownloadStats(dataset);
        if (requesterUid) {
          pointCharge = await recordDatasetPurchaseIfNeeded(
            deps,
            requesterUid,
            dataset,
            now.getTime(),
          );
        }
        await deps.db.runTransaction(async (transaction) => {
          transaction.set(
            deps.db.doc(`datasets/${dataset.id}`),
            {
              downloadCount: result.dataset.downloadCount,
              updatedAt: deps.fieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          transaction.set(
            deps.db.doc(`users/${result.owner.uid}`),
            {
              downloadCount: deps.fieldValue.increment(
                result.owner.downloadCountDelta,
              ),
            },
            { merge: true },
          );
        });
      },
    },
    now,
  );

  return {
    ...result,
    ...(pointCharge ?? {}),
  };
}

async function recordDatasetPurchaseIfNeeded(
  deps: Pick<HandlerDeps, "database" | "db" | "fieldValue">,
  uid: string,
  dataset: Pick<DatasetRecord, "id" | "title" | "pointCost">,
  purchasedAt: number,
): Promise<PointChargeResult> {
  const path = paidDatasetPath(uid, dataset.id);
  const purchaseRef = deps.database.ref(path);
  const existing = await purchaseRef.get();
  if (existing.exists()) {
    const value = existing.val() as Partial<PointChargeResult> | null;
    return {
      pointCost: 0,
      remainingPoints: Number(value?.remainingPoints ?? 0),
    };
  }

  const pointCost = normalizePointCost(
    dataset.pointCost,
    DEFAULT_DATASET_DOWNLOAD_POINT_COST,
  );
  let chargeResult: PointChargeResult = {
    pointCost,
    remainingPoints: 0,
  };
  await deps.db.runTransaction(async (transaction) => {
    const userRef = deps.db.doc(`users/${uid}`);
    const snapshot = await transaction.get(userRef);
    const currentPoints = Number(snapshot.data()?.points ?? INITIAL_USER_POINTS);
    chargeResult = applyPointCharge(currentPoints, pointCost);
    transaction.set(
      userRef,
      {
        points: chargeResult.remainingPoints,
        updatedAt: deps.fieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  await purchaseRef.set({
    type: "dataset",
    datasetId: dataset.id,
    title: dataset.title,
    pointCost,
    remainingPoints: chargeResult.remainingPoints,
    purchasedAt,
  });

  return chargeResult;
}

function applyCors(response: Pick<Response, "setHeader">): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
