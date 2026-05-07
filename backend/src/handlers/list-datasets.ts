import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import type { DatasetRecord } from "../core/datasets";
import type { HandlerDeps } from "./deps";

export interface ListDatasetsQuery {
  readonly language: string | null;
  readonly task: string | null;
  readonly baseModel: string | null;
  readonly tags: readonly string[];
  readonly sort: "popular" | "newest";
  readonly limit: number;
}

interface DatasetSummaryRecord {
  readonly id: string;
  readonly ownerName: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly rowCount: number;
  readonly likeCount: number;
  readonly downloadCount: number;
  readonly status: string;
}

export function createListDatasetsHandler(
  deps: Pick<HandlerDeps, "db">,
) {
  return async function handleListDatasets(
    request: Pick<Request, "method" | "query">,
    response: Response,
    listDatasetsRequest: (
      query: ListDatasetsQuery,
    ) => Promise<readonly DatasetRecord[]> = (query) =>
      executeListDatasets(deps, query),
  ): Promise<void> {
    applyCors(response);
    if (request.method === "OPTIONS") {
      response.status(204).send();
      return;
    }

    const query = readListDatasetsQuery(request);

    try {
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
  deps: Pick<HandlerDeps, "db">,
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
  const snapshot = await deps.db.collection("datasets").get();
  const records = snapshot.docs.map((doc) => {
    const data = doc.data() as DatasetRecord;
    return {
      ...data,
      id: doc.id,
    };
  });
  return applyListDatasetsQuery(records, query);
}

function applyCors(response: Pick<Response, "setHeader">): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
