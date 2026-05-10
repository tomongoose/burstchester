import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import {
  DEFAULT_MODEL_DOWNLOAD_POINT_COST,
  INITIAL_USER_POINTS,
  applyPointCharge,
  calculateCreatorPayout,
  normalizePointCost,
  paidModelPath,
  type PointChargeResult,
} from "../core/purchases";
import type { HandlerDeps } from "./deps";
import { verifyBearerAuth } from "./bearer-auth";
import { readBearerToken, readStringField } from "./_request-helpers";

export interface RecordModelDownloadHandlerDeps {
  readonly verifyIdToken: HandlerDeps["auth"]["verifyIdToken"];
  readonly recordModelDownload: (input: {
    uid: string;
    modelName: string;
    sourceUrl: string;
  }) => Promise<PointChargeResult>;
}

export function createRecordModelDownloadHandler(
  deps: RecordModelDownloadHandlerDeps,
) {
  return async function handleRecordModelDownload(
    request: Pick<Request, "headers" | "body">,
    response: Response,
  ): Promise<void> {
    const bearerToken = readBearerToken(request);
    if (!bearerToken) {
      response.status(401).json({ ok: false, error: "Missing bearer token." });
      return;
    }

    const modelName = readStringField(request.body, "modelName").trim();
    if (!modelName) {
      response.status(400).json({ ok: false, error: "modelName is required." });
      return;
    }

    try {
      const decoded = await deps.verifyIdToken(bearerToken);
      const result = await deps.recordModelDownload({
        uid: decoded.uid,
        modelName,
        sourceUrl: readStringField(request.body, "sourceUrl").trim(),
      });
      response.status(200).json({ ok: true, modelName, ...result });
    } catch (error) {
      logger.error("recordModelDownload failed", error);
      response.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Model download recording failed.",
      });
    }
  };
}

export function createRecordModelDownload(
  deps: Pick<HandlerDeps, "auth" | "database" | "db" | "fieldValue">,
) {
  const handler = createRecordModelDownloadHandler({
    verifyIdToken: (token) => verifyBearerAuth(deps, token),
    recordModelDownload: (input) => recordModelDownload(deps, input),
  });
  return onRequest({ region: "us-central1" }, handler);
}

export async function recordModelDownload(
  deps: Pick<HandlerDeps, "database" | "db" | "fieldValue">,
  input: { uid: string; modelName: string; sourceUrl: string },
): Promise<PointChargeResult> {
  const path = paidModelPath(input.uid, input.modelName);
  const purchaseRef = deps.database.ref(path);
  const existing = await purchaseRef.get();
  if (existing.exists()) {
    const value = existing.val() as Partial<PointChargeResult> | null;
    return {
      pointCost: 0,
      remainingPoints: Number(value?.remainingPoints ?? 0),
    };
  }

  const modelSnapshot = await deps.db.doc(`models/${input.modelName}`).get();
  const model = modelSnapshot.exists
    ? (modelSnapshot.data() as { pointCost?: unknown; ownerUid?: unknown })
    : null;
  const pointCost = normalizePointCost(
    model?.pointCost,
    DEFAULT_MODEL_DOWNLOAD_POINT_COST,
  );
  const ownerUid = typeof model?.ownerUid === "string" ? model.ownerUid.trim() : "";
  const creatorPayoutPoints = calculateCreatorPayout(pointCost);
  let chargeResult: PointChargeResult = {
    pointCost,
    remainingPoints: 0,
  };
  await deps.db.runTransaction(async (transaction) => {
    const userRef = deps.db.doc(`users/${input.uid}`);
    const snapshot = await transaction.get(userRef);
    const currentPoints = Number(snapshot.data()?.points ?? INITIAL_USER_POINTS);
    chargeResult = applyPointCharge(currentPoints, pointCost);
    const buyerPointsAfterSettlement =
      ownerUid === input.uid
        ? chargeResult.remainingPoints + creatorPayoutPoints
        : chargeResult.remainingPoints;
    transaction.set(
      userRef,
      {
        points: buyerPointsAfterSettlement,
        updatedAt: deps.fieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    chargeResult = {
      pointCost: chargeResult.pointCost,
      remainingPoints: buyerPointsAfterSettlement,
    };
    if (ownerUid && ownerUid !== input.uid && creatorPayoutPoints > 0) {
      transaction.set(
        deps.db.doc(`users/${ownerUid}`),
        {
          points: deps.fieldValue.increment(creatorPayoutPoints),
          updatedAt: deps.fieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  });

  await purchaseRef.set({
    type: "model",
    modelName: input.modelName,
    sourceUrl: input.sourceUrl,
    ownerUid,
    pointCost,
    creatorPayoutPoints,
    remainingPoints: chargeResult.remainingPoints,
    purchasedAt: Date.now(),
  });
  return chargeResult;
}
