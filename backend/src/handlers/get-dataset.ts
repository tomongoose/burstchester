import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import type { DatasetRecord } from "../core/datasets";
import type { HandlerDeps } from "./deps";
import { readDatasetId } from "./_request-helpers";
import {
  readDatasetOwnerProfiles,
  type DatasetOwnerProfile,
} from "./dataset-owner-profile";

interface DatasetSummaryRecord {
  readonly id: string;
  readonly ownerUid: string;
  readonly ownerName: string;
  readonly ownerPhotoURL: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly rowCount: number;
  readonly likeCount: number;
  readonly downloadCount: number;
  readonly status: string;
  readonly previewSamples: readonly DatasetPreviewSampleRecord[];
}

interface DatasetPreviewMessageRecord {
  readonly role: string;
  readonly content: string;
}

interface DatasetPreviewSampleRecord {
  readonly messages: readonly DatasetPreviewMessageRecord[];
}

interface DatasetDetailRecord {
  readonly dataset: DatasetRecord;
  readonly previewSamples: readonly DatasetPreviewSampleRecord[];
}

export function createGetDatasetHandler(
  deps: Pick<HandlerDeps, "db">,
) {
  return async function handleGetDataset(
    request: Pick<Request, "method" | "query" | "body">,
    response: Response,
    getDatasetRequest: (
      datasetId: string,
    ) => Promise<DatasetDetailRecord | null> = (datasetId) =>
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
      const detail = await getDatasetRequest(datasetId);
      if (!detail) {
        response.status(404).json({
          ok: false,
          error: "Dataset not found.",
        });
        return;
      }

      const ownerProfiles = await readDatasetOwnerProfiles(deps, [
        detail.dataset.ownerUid,
      ]);

      const ownerProfile = ownerProfiles.get(detail.dataset.ownerUid);

      response.status(200).json({
        ok: true,
        dataset: toDatasetSummaryRecord(
          detail.dataset,
          ownerProfile,
          detail.previewSamples,
        ),
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
  deps: Pick<HandlerDeps, "db" | "storage">,
) {
  const handler = createGetDatasetHandler(deps);
  return onRequest({ region: "us-central1" }, (request, response) =>
    handler(request, response),
  );
}

export async function executeGetDataset(
  deps: Pick<HandlerDeps, "db"> & Partial<Pick<HandlerDeps, "storage">>,
  datasetId: string,
): Promise<DatasetDetailRecord | null> {
  const snapshot = await deps.db.doc(`datasets/${datasetId}`).get();
  if (!snapshot.exists) return null;
  const dataset = {
    ...(snapshot.data() as DatasetRecord),
    id: snapshot.id,
  };
  return {
    dataset,
    previewSamples: await readDatasetPreviewSamples(deps, dataset),
  };
}

function toDatasetSummaryRecord(
  dataset: DatasetRecord,
  ownerProfile?: DatasetOwnerProfile,
  previewSamples: readonly DatasetPreviewSampleRecord[] = [],
): DatasetSummaryRecord {
  return {
    id: dataset.id,
    ownerUid: dataset.ownerUid,
    ownerName: ownerProfile?.displayName || dataset.ownerName,
    ownerPhotoURL: ownerProfile?.photoURL ?? "",
    title: dataset.title,
    description: dataset.description,
    tags: dataset.tags,
    rowCount: dataset.rowCount,
    likeCount: dataset.likeCount,
    downloadCount: dataset.downloadCount,
    status: dataset.status,
    previewSamples,
  };
}

function applyCors(response: Pick<Response, "setHeader">): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const PREVIEW_SAMPLE_LIMIT = 3;
const PREVIEW_BYTE_LIMIT = 64 * 1024;
const PREVIEW_MESSAGE_LENGTH_LIMIT = 240;

async function readDatasetPreviewSamples(
  deps: Partial<Pick<HandlerDeps, "storage">>,
  dataset: DatasetRecord,
): Promise<readonly DatasetPreviewSampleRecord[]> {
  if (!deps.storage || !dataset.normalizedStoragePath) return [];

  const bucketName = parseGsBucketName(dataset.storagePath);
  if (!bucketName) return [];

  try {
    const text = await readStorageObjectPrefix(
      deps.storage,
      bucketName,
      dataset.normalizedStoragePath,
      PREVIEW_BYTE_LIMIT,
    );
    return parsePreviewSamples(text, PREVIEW_SAMPLE_LIMIT);
  } catch (error) {
    logger.warn("Dataset preview read failed", {
      datasetId: dataset.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function parseGsBucketName(storagePath: string): string {
  const match = /^gs:\/\/([^/]+)\//.exec(storagePath);
  return match?.[1] ?? "";
}

async function readStorageObjectPrefix(
  storage: HandlerDeps["storage"],
  bucketName: string,
  path: string,
  byteLimit: number,
): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  await new Promise<void>((resolve, reject) => {
    storage
      .bucket(bucketName)
      .file(path)
      .createReadStream({ start: 0, end: byteLimit - 1 })
      .on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(buffer);
        totalBytes += buffer.byteLength;
      })
      .on("error", reject)
      .on("end", resolve);
  });
  return Buffer.concat(chunks, Math.min(totalBytes, byteLimit)).toString("utf8");
}

function parsePreviewSamples(
  jsonlPrefix: string,
  limit: number,
): readonly DatasetPreviewSampleRecord[] {
  const samples: DatasetPreviewSampleRecord[] = [];
  for (const line of jsonlPrefix.split(/\r?\n/)) {
    if (samples.length >= limit) break;
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = parsePreviewSample(trimmed);
    if (parsed) samples.push(parsed);
  }
  return Object.freeze(samples);
}

function parsePreviewSample(line: string): DatasetPreviewSampleRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.messages)) return null;
  const messages = parsed.messages
    .filter(isRecord)
    .map((message) => ({
      role: String(message.role ?? "").trim(),
      content: truncate(String(message.content ?? "").trim(), PREVIEW_MESSAGE_LENGTH_LIMIT),
    }))
    .filter((message) => message.role && message.content);
  if (messages.length === 0) return null;
  return Object.freeze({ messages: Object.freeze(messages) });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}
