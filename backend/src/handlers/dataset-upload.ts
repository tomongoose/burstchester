import { onObjectFinalized } from "firebase-functions/v2/storage";
import { processDatasetUpload } from "../core/datasets";
import type { HandlerDeps } from "./deps";

export function createOnDatasetUpload(
  deps: Pick<HandlerDeps, "db" | "storage" | "clock" | "fieldValue">,
) {
  return onObjectFinalized({ region: "us-central1" }, async (event) => {
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
          const [bytes] = await deps.storage.bucket(bucket).file(path).download();
          return bytes.toString("utf8");
        },
        saveNormalizedText: async (path, text, bucket) => {
          await deps.storage.bucket(bucket).file(path).save(text, {
            contentType: "application/jsonl",
          });
        },
        upsertDataset: async (record) => {
          await deps.db.doc(`datasets/${record.id}`).set(record, { merge: true });
        },
        incrementUserUploads: async (ownerUid) => {
          await deps.db.doc(`users/${ownerUid}`).set(
            {
              uploadCount: deps.fieldValue.increment(1),
            },
            { merge: true },
          );
        },
      },
      deps.clock.now(),
    );
  });
}
