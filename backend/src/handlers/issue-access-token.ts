import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import { buildUserAccessToken } from "../core/access-tokens";
import type { HandlerDeps } from "./deps";
import { readBearerToken, readStringField } from "./_request-helpers";

export interface IssueAccessTokenHandlerDeps {
  readonly verifyIdToken: HandlerDeps["auth"]["verifyIdToken"];
  readonly issueAccessToken: (input: {
    uid: string;
    label: string;
  }) => Promise<{ token: string; tokenId: string }>;
}

export function createIssueAccessTokenHandler(
  deps: IssueAccessTokenHandlerDeps,
) {
  return async function handleIssueAccessToken(
    request: Pick<Request, "headers" | "body">,
    response: Response,
  ): Promise<void> {
    const bearerToken = readBearerToken(request);
    if (!bearerToken) {
      response.status(401).json({ ok: false, error: "Missing bearer token." });
      return;
    }

    try {
      const decoded = await deps.verifyIdToken(bearerToken);
      const issued = await deps.issueAccessToken({
        uid: decoded.uid,
        label: readStringField(request.body, "label"),
      });
      response.status(200).json({ ok: true, ...issued });
    } catch (error) {
      logger.error("issueAccessToken failed", error);
      response.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Access token issue failed.",
      });
    }
  };
}

export function createIssueAccessToken(
  deps: Pick<HandlerDeps, "auth" | "clock" | "db" | "generateId">,
) {
  const handler = createIssueAccessTokenHandler({
    verifyIdToken: deps.auth.verifyIdToken,
    issueAccessToken: async (input) => {
      const issued = buildUserAccessToken(
        input,
        () => deps.generateId(),
        () => randomBytes(32).toString("base64url"),
        deps.clock.now(),
      );
      await deps.db.doc(`accessTokens/${issued.record.id}`).set(issued.record);
      return {
        token: issued.token,
        tokenId: issued.record.id,
      };
    },
  });
  return onRequest({ region: "us-central1" }, handler);
}
