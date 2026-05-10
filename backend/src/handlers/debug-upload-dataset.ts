import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import {
  processDatasetUpload,
  type DatasetRecord,
} from "../core/datasets";
import type { HandlerDeps } from "./deps";
import {
  readBearerToken,
  readRecordField,
  readStringField,
  stripUndefinedDeep,
} from "./_request-helpers";
import { verifyBearerAuth } from "./bearer-auth";

export const DEBUG_UPLOAD_STORAGE_PREFIX = "debug-uploads";

export interface DebugUploadDatasetHandlerDeps {
  readonly verifyToken: HandlerDeps["auth"]["verifyIdToken"];
  readonly uploadDataset: (input: {
    ownerUid: string;
    ownerName: string;
    filename: string;
    content: string;
    metadata: Record<string, unknown>;
  }) => Promise<Pick<DatasetRecord, "id" | "status" | "normalizedStoragePath">>;
}

export function createDebugUploadDatasetHandler(
  deps: DebugUploadDatasetHandlerDeps,
) {
  return async function handleDebugUploadDataset(
    request: Pick<Request, "headers" | "body">,
    response: Response,
  ): Promise<void> {
    const bearerToken = readBearerToken(request);
    if (!bearerToken) {
      response.status(401).json({ ok: false, error: "Missing bearer token." });
      return;
    }

    const content = readStringField(request.body, "content");
    if (!content.trim()) {
      response.status(400).json({ ok: false, error: "content is required." });
      return;
    }

    try {
      const decoded = await deps.verifyToken(bearerToken);
      const metadata = readRecordField(request.body, "metadata");
      const dataset = await deps.uploadDataset({
        ownerUid: decoded.uid,
        ownerName: decoded.name || decoded.email || decoded.uid,
        filename: resolveDebugFilename(readStringField(request.body, "filename")),
        content,
        metadata: {
          ...metadata,
          title: readStringField(request.body, "title") || metadata.title,
          description:
            readStringField(request.body, "description") || metadata.description,
          tags: readStringField(request.body, "tags") || metadata.tags,
          baseModelHint:
            readStringField(request.body, "baseModelHint") ||
            metadata.baseModelHint,
          taskType:
            readStringField(request.body, "taskType") || metadata.taskType,
          language:
            readStringField(request.body, "language") || metadata.language,
          license: readStringField(request.body, "license") || metadata.license,
          sourceModel:
            readStringField(request.body, "sourceModel") || metadata.sourceModel,
          outputModelId:
            readStringField(request.body, "outputModelId") ||
            metadata.outputModelId,
          pointCost: readStringField(request.body, "pointCost") || metadata.pointCost,
        },
      });

      response.status(200).json({ ok: true, dataset });
    } catch (error) {
      logger.error("debugUploadDataset failed", error);
      response.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Debug dataset upload failed.",
      });
    }
  };
}

export function createDebugUploadDataset(
  deps: Pick<HandlerDeps, "auth" | "db" | "storage" | "clock" | "fieldValue">,
) {
  const handler = createDebugUploadDatasetHandler({
    verifyToken: (token) => verifyBearerAuth(deps, token),
    uploadDataset: (input) => uploadDebugDatasetRecord(deps, input),
  });
  return onRequest({ region: "us-central1" }, handler);
}

export async function uploadDebugDatasetRecord(
  deps: Pick<HandlerDeps, "db" | "storage" | "clock" | "fieldValue">,
  input: {
    ownerUid: string;
    ownerName: string;
    filename: string;
    content: string;
    metadata: Record<string, unknown>;
  },
): Promise<Pick<DatasetRecord, "id" | "status" | "normalizedStoragePath">> {
  const bucket = deps.storage.bucket();
  const datasetId = randomUUID();
  const storagePath = `${DEBUG_UPLOAD_STORAGE_PREFIX}/${input.ownerUid}/${datasetId}.jsonl`;
  const sourceModel =
    typeof input.metadata.sourceModel === "string" &&
    input.metadata.sourceModel.trim()
      ? input.metadata.sourceModel.trim()
      : "human";

  await bucket.file(storagePath).save(input.content, {
    contentType: "application/jsonl",
  });

  const record = await processDatasetUpload(
    {
      name: storagePath,
      bucket: bucket.name,
      contentType: "application/jsonl",
      size: Buffer.byteLength(input.content, "utf8"),
      metadata: {
        datasetId,
        ownerUid: input.ownerUid,
        ownerName: input.ownerName,
        title:
          typeof input.metadata.title === "string" &&
          input.metadata.title.trim()
            ? input.metadata.title.trim()
            : deriveDebugTitle(input.filename),
        description:
          typeof input.metadata.description === "string"
            ? input.metadata.description.trim()
            : "",
        tags:
          typeof input.metadata.tags === "string" && input.metadata.tags.trim()
            ? input.metadata.tags.trim()
            : "debug,test",
        baseModelHint:
          typeof input.metadata.baseModelHint === "string"
            ? input.metadata.baseModelHint.trim()
            : "",
        taskType:
          typeof input.metadata.taskType === "string"
            ? input.metadata.taskType.trim()
            : "instruction",
        language:
          typeof input.metadata.language === "string" &&
          input.metadata.language.trim()
            ? input.metadata.language.trim()
            : "unknown",
        license:
          typeof input.metadata.license === "string" &&
          input.metadata.license.trim()
            ? input.metadata.license.trim()
            : "custom",
        sourceModel,
        sourceConfirmed: "true",
        outputModelId:
          typeof input.metadata.outputModelId === "string"
            ? input.metadata.outputModelId.trim()
            : "",
        pointCost:
          typeof input.metadata.pointCost === "string"
            ? input.metadata.pointCost.trim()
            : "",
      },
    },
    {
      downloadObjectText: async () => input.content,
      saveNormalizedText: async (path, text, targetBucket) => {
        await deps.storage.bucket(targetBucket).file(path).save(text, {
          contentType: "application/jsonl",
        });
      },
      upsertDataset: async (datasetRecord) => {
        await deps.db
          .doc(`datasets/${datasetRecord.id}`)
          .set(stripUndefinedDeep(datasetRecord), { merge: true });
      },
      incrementUserUploads: async (ownerUid) => {
        await deps.db.doc(`users/${ownerUid}`).set(
          { uploadCount: deps.fieldValue.increment(1) },
          { merge: true },
        );
      },
    },
    deps.clock.now(),
  );

  return {
    id: record.id,
    status: record.status,
    normalizedStoragePath: record.normalizedStoragePath,
  };
}

function resolveDebugFilename(filename: string): string {
  const normalized = filename.trim();
  if (normalized) return normalized;
  return `debug-${randomUUID()}.jsonl`;
}

function deriveDebugTitle(filename: string): string {
  const fileName = filename.split("/").at(-1) ?? "Debug Dataset";
  const stripped = fileName.replace(/\.jsonl$/i, "").trim();
  return stripped || "Debug Dataset";
}
