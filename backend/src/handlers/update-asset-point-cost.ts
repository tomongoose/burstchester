import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import {
  DEFAULT_DATASET_DOWNLOAD_POINT_COST,
  DEFAULT_MODEL_DOWNLOAD_POINT_COST,
  normalizePointCost,
} from "../core/purchases";
import type { HandlerDeps } from "./deps";
import { readBearerToken, readStringField } from "./_request-helpers";

type AssetType = "dataset" | "model";

export interface UpdateAssetPointCostHandlerDeps {
  readonly verifyIdToken: HandlerDeps["auth"]["verifyIdToken"];
  readonly updateAssetPointCost: (input: {
    uid: string;
    assetType: AssetType;
    assetId: string;
    pointCost: number;
  }) => Promise<void>;
}

export function createUpdateAssetPointCostHandler(
  deps: UpdateAssetPointCostHandlerDeps,
) {
  return async function handleUpdateAssetPointCost(
    request: Pick<Request, "headers" | "body">,
    response: Response,
  ): Promise<void> {
    const bearerToken = readBearerToken(request);
    if (!bearerToken) {
      response.status(401).json({ ok: false, error: "Missing bearer token." });
      return;
    }

    const assetType = readAssetType(readStringField(request.body, "assetType"));
    const assetId = readStringField(request.body, "assetId").trim();
    if (!assetType || !assetId) {
      response.status(400).json({ ok: false, error: "assetType and assetId are required." });
      return;
    }

    const fallback = assetType === "dataset"
      ? DEFAULT_DATASET_DOWNLOAD_POINT_COST
      : DEFAULT_MODEL_DOWNLOAD_POINT_COST;
    const pointCost = normalizePointCost(
      readStringField(request.body, "pointCost"),
      fallback,
    );

    try {
      const decoded = await deps.verifyIdToken(bearerToken);
      await deps.updateAssetPointCost({
        uid: decoded.uid,
        assetType,
        assetId,
        pointCost,
      });
      response.status(200).json({ ok: true, assetType, assetId, pointCost });
    } catch (error) {
      logger.error("updateAssetPointCost failed", error);
      response.status(403).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Point cost update failed.",
      });
    }
  };
}

export function createUpdateAssetPointCost(
  deps: Pick<HandlerDeps, "auth" | "db" | "fieldValue">,
) {
  const handler = createUpdateAssetPointCostHandler({
    verifyIdToken: deps.auth.verifyIdToken,
    updateAssetPointCost: (input) => updateAssetPointCost(deps, input),
  });
  return onRequest({ region: "us-central1" }, handler);
}

async function updateAssetPointCost(
  deps: Pick<HandlerDeps, "db" | "fieldValue">,
  input: {
    uid: string;
    assetType: AssetType;
    assetId: string;
    pointCost: number;
  },
): Promise<void> {
  const collection = input.assetType === "dataset" ? "datasets" : "models";
  const ref = deps.db.doc(`${collection}/${input.assetId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error(`${input.assetType} not found.`);
  }

  const ownerUid = String(snapshot.data()?.ownerUid ?? "");
  if (ownerUid !== input.uid) {
    throw new Error("Only the owner can update point cost.");
  }

  await ref.set(
    {
      pointCost: input.pointCost,
      updatedAt: deps.fieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

function readAssetType(value: string): AssetType | null {
  if (value === "dataset" || value === "model") return value;
  return null;
}
