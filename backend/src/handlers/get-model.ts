import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import type { ModelRecord } from "../core/model-registry";
import type { HandlerDeps } from "./deps";
import { readBearerToken } from "./_request-helpers";
import { toModelSummaryRecordWithOwner } from "./list-models";

export function createGetModelHandler(
  deps: Pick<HandlerDeps, "auth" | "db">,
) {
  return async function handleGetModel(
    request: Pick<Request, "method" | "headers" | "query" | "body">,
    response: Response,
    getModelRequest: (
      modelId: string,
    ) => Promise<ModelRecord | null> = (modelId) =>
      executeGetModel(deps, modelId),
  ): Promise<void> {
    applyCors(response);
    if (request.method === "OPTIONS") {
      response.status(204).send();
      return;
    }

    const bearerToken = readBearerToken(request);
    if (!bearerToken) {
      response.status(401).json({ ok: false, error: "Missing bearer token." });
      return;
    }

    const modelId = readModelId(request);
    if (!modelId) {
      response.status(400).json({ ok: false, error: "modelId is required." });
      return;
    }

    try {
      await deps.auth.verifyIdToken(bearerToken);
      const model = await getModelRequest(modelId);
      if (!model) {
        response.status(404).json({ ok: false, error: "Model not found." });
        return;
      }

      response.status(200).json({
        ok: true,
        model: await toModelSummaryRecordWithOwner(deps, model),
      });
    } catch (error) {
      logger.error("getModel failed", error);
      response.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Model lookup failed.",
      });
    }
  };
}

export function createGetModel(
  deps: Pick<HandlerDeps, "auth" | "db">,
) {
  const handler = createGetModelHandler(deps);
  return onRequest({ region: "us-central1" }, (request, response) =>
    handler(request, response),
  );
}

export async function executeGetModel(
  deps: Pick<HandlerDeps, "db">,
  modelId: string,
): Promise<ModelRecord | null> {
  const snapshot = await deps.db.doc(`models/${modelId}`).get();
  if (!snapshot.exists) return null;
  return {
    ...(snapshot.data() as ModelRecord),
    id: snapshot.id,
  };
}

function readModelId(
  request: Pick<Request, "query" | "body">,
): string {
  const queryValue = request.query?.modelId;
  const firstQueryValue = Array.isArray(queryValue) ? queryValue[0] : queryValue;
  const value = typeof firstQueryValue === "string"
    ? firstQueryValue
    : typeof request.body?.modelId === "string"
      ? request.body.modelId
      : "";
  return value.trim();
}

function applyCors(response: Pick<Response, "setHeader">): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
