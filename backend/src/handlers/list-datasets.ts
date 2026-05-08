import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import type { DatasetRecord } from "../core/datasets";
import type { HandlerDeps } from "./deps";
import { readBearerToken } from "./_request-helpers";

const LIST_DATASETS_MIN_INTERVAL_MS = 5_000;
const LIST_DATASETS_QUERY_LIMIT = 100;

export interface ListDatasetsQuery {
  readonly ownerUid: string | null;
  readonly language: string | null;
  readonly task: string | null;
  readonly baseModel: string | null;
  readonly tags: readonly string[];
  readonly sort: "popular" | "newest";
  readonly limit: number;
}

interface DatasetSummaryRecord {
  readonly id: string;
  readonly ownerUid: string;
  readonly ownerName: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly rowCount: number;
  readonly likeCount: number;
  readonly downloadCount: number;
  readonly status: string;
}

interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterMs?: number;
}

interface ServerQueryFilter {
  readonly field: "ownerUid" | "tags" | "language" | "taskType" | "baseModelHint";
  readonly operator: "array-contains-any" | "==";
  readonly value: string | readonly string[];
}

interface ListDatasetsServerQueryPlan {
  readonly serverFilter: ServerQueryFilter | null;
  readonly orderField: "downloadCount" | "createdAt";
  readonly orderDirection: "desc";
  readonly queryLimit: number;
}

export function createListDatasetsHandler(
  deps: Pick<HandlerDeps, "db" | "database" | "auth" | "clock">,
) {
  return async function handleListDatasets(
    request: Pick<Request, "method" | "query" | "headers">,
    response: Response,
    listDatasetsRequest: (
      query: ListDatasetsQuery,
    ) => Promise<readonly DatasetRecord[]> = (query) =>
      executeListDatasets(deps, query),
    verifyIdToken: (idToken: string) => Promise<{ uid: string }> = (idToken) =>
      deps.auth.verifyIdToken(idToken),
    checkRateLimit: (
      uid: string,
      rateLimitKey: string,
    ) => Promise<RateLimitResult> = (uid, rateLimitKey) =>
      enforceListDatasetsRateLimit(deps, uid, rateLimitKey),
  ): Promise<void> {
    applyCors(response);
    if (request.method === "OPTIONS") {
      response.status(204).send();
      return;
    }

    const bearerToken = readBearerToken(request);
    if (!bearerToken) {
      response.status(401).json({
        ok: false,
        error: "Missing bearer token.",
      });
      return;
    }

    const query = readListDatasetsQuery(request);

    try {
      const decoded = await verifyIdToken(bearerToken);
      const rateLimitKey = buildListDatasetsRateLimitKey(decoded.uid, query);
      const rateLimit = await checkRateLimit(decoded.uid, rateLimitKey);
      if (!rateLimit.allowed) {
        response.status(429).json({
          ok: false,
          error: "Rate limit exceeded. Try again in a few seconds.",
          retryAfterMs: rateLimit.retryAfterMs ?? LIST_DATASETS_MIN_INTERVAL_MS,
        });
        return;
      }

      const datasets = await listDatasetsRequest(query);
      response.status(200).json({
        ok: true,
        datasets: datasets.map(toDatasetSummaryRecord),
      });
    } catch (error) {
      logger.error("listDatasets failed", error);
      response.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Dataset listing failed.",
      });
    }
  };
}

export function createListDatasets(
  deps: Pick<HandlerDeps, "db" | "database" | "auth" | "clock">,
) {
  const handler = createListDatasetsHandler(deps);
  return onRequest({ region: "us-central1" }, (request, response) =>
    handler(request, response),
  );
}

export function readListDatasetsQuery(
  request: Pick<Request, "query">,
): ListDatasetsQuery {
  const sort = request.query?.sort === "newest" ? "newest" : "popular";
  const limitValue = Number(request.query?.limit ?? 24);
  return {
    ownerUid: readQueryString(request, "ownerUid"),
    language: readQueryString(request, "language"),
    task: readQueryString(request, "task"),
    baseModel: readQueryString(request, "baseModel"),
    tags: readCommaSeparatedQuery(request, "tags"),
    sort,
    limit:
      Number.isInteger(limitValue) && limitValue > 0
        ? Math.min(limitValue, 50)
        : 24,
  };
}

export async function executeListDatasets(
  deps: Pick<HandlerDeps, "db">,
  query: ListDatasetsQuery,
): Promise<readonly DatasetRecord[]> {
  if (query.ownerUid) {
    const snapshot = await deps.db
      .collection("datasets")
      .where("status", "==", "active")
      .where("ownerUid", "==", query.ownerUid)
      .limit(LIST_DATASETS_QUERY_LIMIT)
      .get();
    const records = snapshot.docs.map((doc) => ({
      ...(doc.data() as DatasetRecord),
      id: doc.id,
    }));
    return applyListDatasetsQuery(records, query);
  }

  const plan = buildListDatasetsServerQueryPlan(query);
  let ref: FirebaseFirestore.Query = deps.db
    .collection("datasets")
    .where("status", "==", "active");

  if (plan.serverFilter) {
    ref = ref.where(
      plan.serverFilter.field,
      plan.serverFilter.operator,
      plan.serverFilter.value,
    );
  }

  ref = ref.orderBy(plan.orderField, plan.orderDirection).limit(plan.queryLimit);
  const snapshot = await ref.get();
  const records = snapshot.docs.map((doc) => {
    const data = doc.data() as DatasetRecord;
    return {
      ...data,
      id: doc.id,
    };
  });
  return applyListDatasetsQuery(records, query);
}

export function buildListDatasetsServerQueryPlan(
  query: ListDatasetsQuery,
): ListDatasetsServerQueryPlan {
  const orderField = query.sort === "newest" ? "createdAt" : "downloadCount";

  if (query.ownerUid) {
    return {
      serverFilter: {
        field: "ownerUid",
        operator: "==",
        value: query.ownerUid,
      },
      orderField,
      orderDirection: "desc",
      queryLimit: LIST_DATASETS_QUERY_LIMIT,
    };
  }

  if (query.tags.length > 0) {
    return {
      serverFilter: {
        field: "tags",
        operator: "array-contains-any",
        value: [...query.tags],
      },
      orderField,
      orderDirection: "desc",
      queryLimit: LIST_DATASETS_QUERY_LIMIT,
    };
  }

  if (query.baseModel) {
    return {
      serverFilter: {
        field: "baseModelHint",
        operator: "==",
        value: query.baseModel,
      },
      orderField,
      orderDirection: "desc",
      queryLimit: LIST_DATASETS_QUERY_LIMIT,
    };
  }

  if (query.task) {
    return {
      serverFilter: {
        field: "taskType",
        operator: "==",
        value: query.task,
      },
      orderField,
      orderDirection: "desc",
      queryLimit: LIST_DATASETS_QUERY_LIMIT,
    };
  }

  if (query.language) {
    return {
      serverFilter: {
        field: "language",
        operator: "==",
        value: query.language,
      },
      orderField,
      orderDirection: "desc",
      queryLimit: LIST_DATASETS_QUERY_LIMIT,
    };
  }

  return {
    serverFilter: null,
    orderField,
    orderDirection: "desc",
    queryLimit: LIST_DATASETS_QUERY_LIMIT,
  };
}

export async function enforceListDatasetsRateLimit(
  deps: Pick<HandlerDeps, "database" | "clock">,
  uid: string,
  rateLimitKey: string,
): Promise<RateLimitResult> {
  const ref = deps.database.ref(
    `_requestRateLimits/listDatasets/${rateLimitKey}`,
  );
  const now = deps.clock.now();

  const result = await ref.transaction((current) => {
    const nowMs = now.toMillis();
    const previous =
      current && typeof current === "object"
        ? toEpochMillis((current as { lastRequestAt?: unknown }).lastRequestAt)
        : 0;
    const elapsedMs = previous > 0 ? nowMs - previous : LIST_DATASETS_MIN_INTERVAL_MS;

    if (elapsedMs < LIST_DATASETS_MIN_INTERVAL_MS) {
      return;
    }

    return {
      uid,
      lastRequestAt: nowMs,
    };
  });

  if (!result.committed) {
    const current = result.snapshot.val() as
      | { lastRequestAt?: number }
      | null;
    const previous = current?.lastRequestAt ?? 0;
    const elapsedMs = now.toMillis() - previous;
    return {
      allowed: false,
      retryAfterMs: Math.max(0, LIST_DATASETS_MIN_INTERVAL_MS - elapsedMs),
    };
  }

  return { allowed: true };
}

export function buildListDatasetsRateLimitKey(
  uid: string,
  query: ListDatasetsQuery,
): string {
  return [
    uid,
    query.sort,
    query.ownerUid ?? "",
    query.language ?? "",
    query.task ?? "",
    query.baseModel ?? "",
    query.tags.join(","),
    String(query.limit),
  ].join("::");
}

function applyCors(response: Pick<Response, "setHeader">): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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

function readCommaSeparatedQuery(
  request: Pick<Request, "query">,
  key: string,
): readonly string[] {
  const value = readQueryString(request, key);
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function applyListDatasetsQuery(
  datasets: readonly DatasetRecord[],
  query: ListDatasetsQuery,
): readonly DatasetRecord[] {
  const filtered = datasets
    .filter((dataset) => dataset.status === "active")
    .filter((dataset) => !query.ownerUid || dataset.ownerUid === query.ownerUid)
    .filter((dataset) => !query.language || dataset.language === query.language)
    .filter((dataset) => !query.task || dataset.taskType === query.task)
    .filter((dataset) => !query.baseModel || dataset.baseModelHint === query.baseModel)
    .filter((dataset) =>
      query.tags.length === 0
        ? true
        : query.tags.some((tag) => dataset.tags.includes(tag)),
    );

  const sorted = [...filtered].sort((left, right) => {
    if (query.sort === "newest") {
      const leftMs = toEpochMillis(left.createdAt);
      const rightMs = toEpochMillis(right.createdAt);
      return rightMs - leftMs;
    }
    return right.downloadCount - left.downloadCount;
  });

  return sorted.slice(0, query.limit);
}

function toDatasetSummaryRecord(dataset: DatasetRecord): DatasetSummaryRecord {
  return {
    id: dataset.id,
    ownerUid: dataset.ownerUid,
    ownerName: dataset.ownerName,
    title: dataset.title,
    description: dataset.description,
    tags: dataset.tags,
    rowCount: dataset.rowCount,
    likeCount: dataset.likeCount,
    downloadCount: dataset.downloadCount,
    status: dataset.status,
  };
}

function toEpochMillis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    const fn = (value as { toMillis: () => number }).toMillis;
    return typeof fn === "function" ? fn() : 0;
  }
  return 0;
}
