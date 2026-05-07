import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { buildModelRecord } from "../core/model-registry";
import type { HandlerDeps } from "./deps";

export function createRegisterModel(
  deps: Pick<HandlerDeps, "db" | "clock" | "generateId">,
) {
  return onCall({ region: "us-central1" }, async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    try {
      const record = buildModelRecord(
        {
          ownerUid: request.auth.uid,
          huggingFaceUrl: String(request.data?.huggingFaceUrl ?? ""),
          baseModel: typeof request.data?.baseModel === "string" ? request.data.baseModel : undefined,
          trainingDatasets: Array.isArray(request.data?.trainingDatasets)
            ? request.data.trainingDatasets.map((value: unknown) => String(value))
            : undefined,
          trainingMethod: typeof request.data?.trainingMethod === "string" ? request.data.trainingMethod : undefined,
          ollamaPullUrl: typeof request.data?.ollamaPullUrl === "string" ? request.data.ollamaPullUrl : null,
        },
        () => `model-${deps.generateId()}`,
        deps.clock.now(),
      );

      await deps.db.doc(`models/${record.id}`).set(record);

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
}
