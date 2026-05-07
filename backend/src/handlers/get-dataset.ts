import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import type { DatasetRecord } from "../core/datasets";
import type { HandlerDeps } from "./deps";
import { readDatasetId } from "./_request-helpers";

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

export function createGetDatasetHandler(
  deps: Pick<HandlerDeps, "db">,
) {
  return async function handleGetDataset(
    request: Pick<Request, "method" | "query" | "body">,
    response: Response,
    getDatasetRequest: (
      datasetId: string,
    ) => Promise<DatasetRecord | null> = (datasetId) =>
      executeGetDataset(deps, datasetId),
  ): Promise<void> {
    applyCors(response);
    if (request.method === "OPTIONS") {
      response.status(204).send();
      return;
    }

    const datasetId = readDatasetId(request);
    if (!datasetId) {
      response.status(400).json({
        ok: false,
        error: "datasetId is required.",
      });
      return;
    }

    try {
      const dataset = await getDatasetRequest(datasetId);
      if (!dataset) {
        response.status(404).json({
          ok: false,
          error: "Dataset not found.",
        });
        return;
      }

      response.status(200).json({
        ok: true,
        dataset: toDatasetSummaryRecord(dataset),
      });
    } catch (error) {
      logger.error("getDataset failed", error);
      response.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Dataset lookup failed.",
      });
    }
  };
}

export function createGetDataset(
  deps: Pick<HandlerDeps, "db">,
) {
  const handler = createGetDatasetHandler(deps);
  return onRequest({ region: "us-central1" }, (request, response) =>
    handler(request, response),
  );
}

export async function executeGetDataset(
  deps: Pick<HandlerDeps, "db">,
  datasetId: string,
): Promise<DatasetRecord | null> {
  const snapshot = await deps.db.doc(`datasets/${datasetId}`).get();
  if (!snapshot.exists) return null;
  return {
    ...(snapshot.data() as DatasetRecord),
    id: snapshot.id,
  };
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
