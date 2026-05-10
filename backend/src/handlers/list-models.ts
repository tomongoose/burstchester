import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import type { ModelRecord } from "../core/model-registry";
import type { HandlerDeps } from "./deps";
import { readBearerToken } from "./_request-helpers";

export interface ListModelsQuery {
  readonly sort: "popular" | "newest";
  readonly limit: number;
  readonly ownerUid: string | null;
  readonly baseModel: string | null;
  readonly trainingMethod: "lora" | "qlora" | "full" | null;
}

interface ModelSummaryRecord {
  readonly id: string;
  readonly ownerUid: string;
  readonly ownerName: string;
  readonly baseModel: string;
  readonly trainingDatasets: readonly string[];
  readonly trainingMethod: "lora" | "qlora" | "full";
  readonly huggingFaceUrl: string;
  readonly ollamaPullUrl: string | null;
  readonly pointCost: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ListModelsHandlerDeps {
  readonly verifyIdToken: HandlerDeps["auth"]["verifyIdToken"];
  readonly listModels: (query: ListModelsQuery) => Promise<readonly ModelSummaryRecord[]>;
}

export function createListModelsHandler(deps: ListModelsHandlerDeps) {
  return async function handleListModels(
    request: Pick<Request, "method" | "headers" | "query">,
    response: Response,
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

    try {
      await deps.verifyIdToken(bearerToken);
      const models = await deps.listModels(readListModelsQuery(request));
      response.status(200).json({
        ok: true,
        models,
      });
    } catch (error) {
      logger.error("listModels failed", error);
      response.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Model listing failed.",
      });
    }
  };
}

export function createListModels(
  deps: Pick<HandlerDeps, "auth" | "db">,
) {
  const handler = createListModelsHandler({
    verifyIdToken: deps.auth.verifyIdToken,
    listModels: (query) => executeListModels(deps, query),
  });
  return onRequest({ region: "us-central1" }, (request, response) =>
    handler(request, response),
  );
}

export function readListModelsQuery(
  request: Pick<Request, "query">,
): ListModelsQuery {
  const limitValue = Number(request.query?.limit ?? 24);
  return {
    sort: request.query?.sort === "popular" ? "popular" : "newest",
    ownerUid: readQueryString(request, "ownerUid"),
    baseModel: readQueryString(request, "baseModel"),
    trainingMethod: readTrainingMethod(request),
    limit:
      Number.isInteger(limitValue) && limitValue > 0
        ? Math.min(limitValue, 50)
        : 24,
  };
}

export async function executeListModels(
  deps: Pick<HandlerDeps, "db">,
  query: ListModelsQuery,
): Promise<readonly ModelSummaryRecord[]> {
  let ref: FirebaseFirestore.Query = deps.db.collection("models");
  if (query.ownerUid) {
    ref = ref.where("ownerUid", "==", query.ownerUid).limit(Math.max(query.limit, 50));
  } else if (query.baseModel) {
    ref = ref.where("baseModel", "==", query.baseModel).limit(Math.max(query.limit, 50));
  } else if (query.trainingMethod) {
    ref = ref.where("trainingMethod", "==", query.trainingMethod).limit(Math.max(query.limit, 50));
  } else {
    ref = ref.orderBy("updatedAt", "desc").limit(query.limit);
  }
  const snapshot = await ref.get();

  const models = snapshot.docs.map((doc) => ({
    ...(doc.data() as ModelRecord),
    id: doc.id,
  }))
    .filter((model) => !query.ownerUid || model.ownerUid === query.ownerUid)
    .filter((model) => !query.baseModel || model.baseModel === query.baseModel)
    .filter((model) => !query.trainingMethod || model.trainingMethod === query.trainingMethod)
    .sort((left, right) => timestampToMillis(right.updatedAt) - timestampToMillis(left.updatedAt))
    .slice(0, query.limit);
  return Promise.all(models.map((model) => toModelSummaryRecordWithOwner(deps, model)));
}

export function toModelSummaryRecord(model: ModelRecord): ModelSummaryRecord {
  return {
    id: model.id,
    ownerUid: model.ownerUid,
    ownerName: "",
    baseModel: model.baseModel,
    trainingDatasets: model.trainingDatasets,
    trainingMethod: model.trainingMethod,
    huggingFaceUrl: model.huggingFaceUrl,
    ollamaPullUrl: model.ollamaPullUrl,
    pointCost: model.pointCost,
    createdAt: timestampToIso(model.createdAt),
    updatedAt: timestampToIso(model.updatedAt),
  };
}

export async function toModelSummaryRecordWithOwner(
  deps: Pick<HandlerDeps, "db">,
  model: ModelRecord,
): Promise<ModelSummaryRecord> {
  const summary = toModelSummaryRecord(model);
  const snapshot = await deps.db.doc(`users/${model.ownerUid}`).get();
  const ownerName = snapshot.exists
    ? String(snapshot.data()?.displayName ?? "").trim()
    : "";
  return {
    ...summary,
    ownerName,
  };
}

function readTrainingMethod(
  request: Pick<Request, "query">,
): "lora" | "qlora" | "full" | null {
  const value = readQueryString(request, "trainingMethod");
  if (value === "lora" || value === "qlora" || value === "full") return value;
  return null;
}

function applyCors(response: Pick<Response, "setHeader">): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function timestampToIso(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value) {
    const timestamp = value as { toDate: () => Date };
    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate().toISOString();
    }
  }
  return new Date(0).toISOString();
}

function readQueryString(
  request: Pick<Request, "query">,
  key: string,
): string | null {
  const value = request.query?.[key];
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = typeof first === "string" ? first.trim() : "";
  return trimmed ? trimmed : null;
}

function timestampToMillis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    const timestamp = value as { toMillis: () => number };
    if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const timestamp = value as { toDate: () => Date };
    if (typeof timestamp.toDate === "function") return timestamp.toDate().getTime();
  }
  return 0;
}
