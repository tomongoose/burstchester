import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import type { DatasetRecord } from "../core/datasets";
import { applyDownloadStats } from "../core/engagement";
import { prepareDownloadCore } from "../core/packaging";
import type { HandlerDeps } from "./deps";
import { pathFromGsUrl, readDatasetId } from "./_request-helpers";

type PrepareDownloadResult = Awaited<ReturnType<typeof prepareDownloadCore>>;

export function createPrepareDatasetDownloadHandler(
  deps: Pick<HandlerDeps, "db" | "storage" | "fieldValue">,
) {
  return async function handlePrepareDatasetDownload(
    request: Pick<Request, "query" | "body">,
    response: Response,
    prepareDownloadRequest: (
      datasetId: string,
    ) => Promise<PrepareDownloadResult> = (datasetId) =>
      executePrepareDownload(deps, datasetId),
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
        error:
          error instanceof Error
            ? error.message
            : "Dataset download preparation failed.",
      });
    }
  };
}

export function createPrepareDatasetDownload(
  deps: Pick<HandlerDeps, "db" | "storage" | "fieldValue">,
) {
  const handler = createPrepareDatasetDownloadHandler(deps);
  return onRequest({ region: "us-central1" }, (request, response) =>
    handler(request, response),
  );
}

export async function executePrepareDownload(
  deps: Pick<HandlerDeps, "db" | "storage" | "fieldValue">,
  datasetId: string,
  requesterUid?: string,
): Promise<PrepareDownloadResult> {
  const now = new Date();
  const signedUrlExpiresAt = now.getTime() + 60 * 60 * 1000;
  return prepareDownloadCore(
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
      getSignedUrl: async (path) => {
        const [url] = await deps.storage.bucket().file(path).getSignedUrl({
          action: "read",
          expires: signedUrlExpiresAt,
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
}
