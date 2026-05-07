import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

import type { DatasetRecord } from "../core/datasets";
import type { HandlerDeps } from "./deps";

const TRENDING_DATASETS_LIMIT = 6;
const TRENDING_DATASETS_PATH = "public/trendingDatasets";

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

export interface TrendingDatasetsCacheRecord {
  readonly updatedAt: number;
  readonly datasets: readonly DatasetSummaryRecord[];
}

export function createListTrendingDatasetsHandler(
  deps: Pick<HandlerDeps, "database">,
) {
  return async function handleListTrendingDatasets(
    request: Pick<Request, "method">,
    response: Response,
    readTrendingDatasets: () => Promise<TrendingDatasetsCacheRecord> = () =>
      readTrendingDatasetsCache(deps),
  ): Promise<void> {
    applyCors(response);
    if (request.method === "OPTIONS") {
      response.status(204).send();
      return;
    }

    try {
      const cache = await readTrendingDatasets();
      response.status(200).json({
        ok: true,
        updatedAt: cache.updatedAt,
        datasets: cache.datasets,
      });
    } catch (error) {
      logger.error("listTrendingDatasets failed", error);
      response.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Trending dataset listing failed.",
      });
    }
  };
}

export function createListTrendingDatasets(
  deps: Pick<HandlerDeps, "database">,
) {
  const handler = createListTrendingDatasetsHandler(deps);
  return onRequest({ region: "us-central1" }, (request, response) =>
    handler(request, response),
  );
}

export function createRefreshTrendingDatasets(
  deps: Pick<HandlerDeps, "db" | "database">,
) {
  return onSchedule(
    { region: "us-central1", schedule: "every 30 minutes" },
    async () => {
      await executeRefreshTrendingDatasets(deps, Date.now());
    },
  );
}

export async function executeRefreshTrendingDatasets(
  deps: Pick<HandlerDeps, "db" | "database">,
  updatedAt: number,
): Promise<void> {
  const snapshot = await deps.db
    .collection("datasets")
    .where("status", "==", "active")
    .orderBy("downloadCount", "desc")
    .limit(TRENDING_DATASETS_LIMIT)
    .get();

  const datasets = snapshot.docs.map((doc) =>
    toDatasetSummaryRecord({
      ...(doc.data() as DatasetRecord),
      id: doc.id,
    }),
  );

  await deps.database.ref(TRENDING_DATASETS_PATH).set({
    updatedAt,
    datasets,
  });
}

async function readTrendingDatasetsCache(
  deps: Pick<HandlerDeps, "database">,
): Promise<TrendingDatasetsCacheRecord> {
  const snapshot = await deps.database.ref(TRENDING_DATASETS_PATH).get();
  const value = snapshot.val() as TrendingDatasetsCacheRecord | null;
  return (
    value ?? {
      updatedAt: 0,
      datasets: [],
    }
  );
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

function applyCors(response: Pick<Response, "setHeader">): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
