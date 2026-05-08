import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import type { Timestamp } from "firebase-admin/firestore";

import type { UserAccessTokenRecord } from "../core/access-tokens";
import type { HandlerDeps } from "./deps";
import { readBearerToken, readStringField } from "./_request-helpers";

export interface AccessTokenSummary {
  readonly id: string;
  readonly label: string;
  readonly createdAt: string;
  readonly lastUsedAt?: string;
}

interface ListAccessTokensHandlerDeps {
  readonly verifyIdToken: HandlerDeps["auth"]["verifyIdToken"];
  readonly listAccessTokens: (uid: string) => Promise<readonly AccessTokenSummary[]>;
}

interface RevokeAccessTokenHandlerDeps {
  readonly verifyIdToken: HandlerDeps["auth"]["verifyIdToken"];
  readonly revokeAccessToken: (uid: string, tokenId: string) => Promise<void>;
}

export function createListAccessTokensHandler(
  deps: ListAccessTokensHandlerDeps,
) {
  return async function handleListAccessTokens(
    request: Pick<Request, "method" | "headers">,
    response: Response,
  ): Promise<void> {
    applyCors(response, "GET,OPTIONS");
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
      const decoded = await deps.verifyIdToken(bearerToken);
      const tokens = await deps.listAccessTokens(decoded.uid);
      response.status(200).json({ ok: true, tokens });
    } catch (error) {
      logger.error("listAccessTokens failed", error);
      response.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Access token listing failed.",
      });
    }
  };
}

export function createRevokeAccessTokenHandler(
  deps: RevokeAccessTokenHandlerDeps,
) {
  return async function handleRevokeAccessToken(
    request: Pick<Request, "method" | "headers" | "body">,
    response: Response,
  ): Promise<void> {
    applyCors(response, "POST,OPTIONS");
    if (request.method === "OPTIONS") {
      response.status(204).send();
      return;
    }

    const bearerToken = readBearerToken(request);
    if (!bearerToken) {
      response.status(401).json({ ok: false, error: "Missing bearer token." });
      return;
    }

    const tokenId = readStringField(request.body, "tokenId").trim();
    if (!tokenId) {
      response.status(400).json({ ok: false, error: "Missing tokenId." });
      return;
    }

    try {
      const decoded = await deps.verifyIdToken(bearerToken);
      await deps.revokeAccessToken(decoded.uid, tokenId);
      response.status(200).json({ ok: true, tokenId });
    } catch (error) {
      logger.error("revokeAccessToken failed", error);
      response.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Access token deletion failed.",
      });
    }
  };
}

export function createListAccessTokens(
  deps: Pick<HandlerDeps, "auth" | "db">,
) {
  const handler = createListAccessTokensHandler({
    verifyIdToken: deps.auth.verifyIdToken,
    listAccessTokens: async (uid) => {
      const snapshot = await deps.db
        .collection(`users/${uid}/accessTokens`)
        .get();
      return snapshot.docs
        .map((doc) => toAccessTokenSummary(doc.data() as UserAccessTokenRecord))
        .filter((token) => token !== null)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
  });
  return onRequest({ region: "us-central1" }, handler);
}

export function createRevokeAccessToken(
  deps: Pick<HandlerDeps, "auth" | "clock" | "db">,
) {
  const handler = createRevokeAccessTokenHandler({
    verifyIdToken: deps.auth.verifyIdToken,
    revokeAccessToken: async (uid, tokenId) => {
      const tokenRef = deps.db.doc(`users/${uid}/accessTokens/${tokenId}`);
      const snapshot = await tokenRef.get();
      const record = snapshot.exists
        ? snapshot.data() as UserAccessTokenRecord
        : null;
      if (!record || record.ownerUid !== uid) {
        throw new Error("Access token not found.");
      }
      await tokenRef.set({ revokedAt: deps.clock.now() }, { merge: true });
    },
  });
  return onRequest({ region: "us-central1" }, handler);
}

function applyCors(response: Pick<Response, "setHeader">, methods: string): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", methods);
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function toAccessTokenSummary(record: UserAccessTokenRecord): AccessTokenSummary | null {
  if (record.revokedAt) return null;
  return {
    id: record.id,
    label: record.label,
    createdAt: timestampToIso(record.createdAt),
    lastUsedAt: record.lastUsedAt ? timestampToIso(record.lastUsedAt) : undefined,
  };
}

function timestampToIso(value: Timestamp): string {
  return value.toDate().toISOString();
}
