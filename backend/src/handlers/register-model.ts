import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { onRequest } from "firebase-functions/v2/https";
import { buildModelRecord } from "../core/model-registry";
import type { HandlerDeps } from "./deps";
import { verifyBearerAuth } from "./bearer-auth";
import { readBearerToken, readStringField } from "./_request-helpers";

export function createRegisterModel(
  deps: Pick<HandlerDeps, "database" | "db" | "clock" | "generateId">,
) {
  return onCall({ region: "us-central1" }, async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    try {
      const record = await registerModelForUser(deps, {
        ownerUid: request.auth.uid,
        huggingFaceUrl: String(request.data?.huggingFaceUrl ?? ""),
        baseModel: typeof request.data?.baseModel === "string" ? request.data.baseModel : undefined,
        trainingDatasets: Array.isArray(request.data?.trainingDatasets)
          ? request.data.trainingDatasets.map((value: unknown) => String(value))
          : undefined,
        trainingMethod: typeof request.data?.trainingMethod === "string" ? request.data.trainingMethod : undefined,
        ollamaPullUrl: typeof request.data?.ollamaPullUrl === "string" ? request.data.ollamaPullUrl : null,
        pointCost: request.data?.pointCost,
      });

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

export function createRegisterModelHttp(
  deps: Pick<HandlerDeps, "auth" | "database" | "db" | "clock" | "generateId" | "fieldValue">,
) {
  return onRequest({ region: "us-central1" }, async (request, response) => {
    await handleRegisterModelHttp(deps, request, response);
  });
}

export async function handleRegisterModelHttp(
  deps: Pick<HandlerDeps, "auth" | "database" | "db" | "clock" | "generateId" | "fieldValue">,
  request: Pick<Request, "headers" | "body">,
  response: Response,
  verifyToken: (token: string) => Promise<{ uid: string }> = (token) =>
    verifyBearerAuth(deps, token),
): Promise<void> {
  const bearerToken = readBearerToken(request);
  if (!bearerToken) {
    response.status(401).json({ ok: false, error: "Missing bearer token." });
    return;
  }

  try {
    const decoded = await verifyToken(bearerToken);
    const record = await registerModelForUser(deps, {
      ownerUid: decoded.uid,
      huggingFaceUrl: readStringField(request.body, "huggingFaceUrl"),
      baseModel: readStringField(request.body, "baseModel"),
      trainingDatasets: readStringArrayField(request.body, "trainingDatasets"),
      trainingMethod: readStringField(request.body, "trainingMethod"),
      ollamaPullUrl: readStringField(request.body, "ollamaPullUrl"),
      pointCost: readStringField(request.body, "pointCost"),
    });
    response.status(200).json({
      ok: true,
      model: {
        id: record.id,
        ownerUid: record.ownerUid,
        huggingFaceUrl: record.huggingFaceUrl,
      },
    });
  } catch (error) {
    logger.error("registerModelHttp failed", error);
    response.status(400).json({
      ok: false,
      error:
        error instanceof Error ? error.message : "Model registration failed.",
    });
  }
}

async function registerModelForUser(
  deps: Pick<HandlerDeps, "database" | "db" | "clock" | "generateId">,
  input: {
    ownerUid: string;
    huggingFaceUrl: string;
    baseModel?: string;
    trainingDatasets?: readonly string[];
    trainingMethod?: string;
    ollamaPullUrl?: string | null;
    pointCost?: unknown;
  },
) {
  const record = buildModelRecord(
    input,
    () => `model-${deps.generateId()}`,
    deps.clock.now(),
    await readPaidTrainingAssets(deps, input.ownerUid),
  );

  await deps.db.doc(`models/${record.id}`).set(record);
  return record;
}

async function readPaidTrainingAssets(
  deps: Pick<HandlerDeps, "database">,
  uid: string,
): Promise<{ paidDatasetIds: string[]; paidModelNames: string[] }> {
  const snapshot = await deps.database.ref(`paidDownloads/${uid}`).get();
  const value = snapshot.exists() ? snapshot.val() as {
    datasets?: Record<string, { datasetId?: unknown }>;
    models?: Record<string, { modelName?: unknown }>;
  } : {};

  return {
    paidDatasetIds: Object.values(value.datasets ?? {})
      .map((entry) => String(entry.datasetId ?? "").trim())
      .filter(Boolean),
    paidModelNames: Object.values(value.models ?? {})
      .map((entry) => String(entry.modelName ?? "").trim())
      .filter(Boolean),
  };
}

function readStringArrayField(body: unknown, field: string): string[] {
  if (!body || typeof body !== "object" || !(field in body)) return [];
  const value = (body as Record<string, unknown>)[field];
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry));
}
