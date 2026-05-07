import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { DatasetRecord } from "../core/datasets";
import { applyDownloadStats } from "../core/engagement";
import { prepareDownloadCore } from "../core/packaging";
import type { HandlerDeps } from "./deps";

export function createPrepareDownload(
  deps: Pick<HandlerDeps, "db" | "storage" | "fieldValue">,
) {
  return onCall({ region: "us-central1" }, async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const datasetId = String(request.data?.datasetId ?? "").trim();
    if (!datasetId) {
      throw new HttpsError("invalid-argument", "datasetId is required.");
    }

    try {
      const now = new Date();
      const signedUrlExpiresAt = now.getTime() + 60 * 60 * 1000;
      return await prepareDownloadCore(
        {
          datasetId,
          requesterUid: request.auth.uid,
        },
        {
          getDataset: async (id) => {
            const snapshot = await deps.db.doc(`datasets/${id}`).get();
            return snapshot.exists ? (snapshot.data() as DatasetRecord) : null;
          },
          downloadNormalizedJsonl: async (dataset) => {
            const path = dataset.normalizedStoragePath ?? pathFromGsUrl(dataset.storagePath);
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
                  downloadCount: deps.fieldValue.increment(result.owner.downloadCountDelta),
                },
                { merge: true },
              );
            });
          },
        },
        now,
      );
    } catch (error) {
      logger.error("prepareDownload failed", error);
      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Download packaging failed.",
      );
    }
  });
}

function pathFromGsUrl(gsUrl: string): string {
  const match = gsUrl.match(/^gs:\/\/[^/]+\/(.+)$/);
  if (!match) {
    throw new Error(`Unsupported storage path: ${gsUrl}`);
  }
  return match[1];
}
