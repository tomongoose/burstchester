import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import { buildUserProfile } from "../core/profiles";
import type { HandlerDeps } from "./deps";
import {
  readBearerToken,
  readOptionalStringField,
  readStringField,
} from "./_request-helpers";

export interface CliProfileRecord {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly photoURL: string;
}

export interface UpsertCliProfileHandlerDeps {
  readonly verifyIdToken: HandlerDeps["auth"]["verifyIdToken"];
  readonly upsertProfile: (input: {
    uid: string;
    email?: string;
    displayName: string;
    photoURL?: string | null;
  }) => Promise<CliProfileRecord>;
}

export function createUpsertCliProfileHandler(
  deps: UpsertCliProfileHandlerDeps,
) {
  return async function handleUpsertCliProfile(
    request: Pick<Request, "headers" | "body">,
    response: Response,
  ): Promise<void> {
    const bearerToken = readBearerToken(request);
    if (!bearerToken) {
      response.status(401).json({ ok: false, error: "Missing bearer token." });
      return;
    }

    const displayName = readStringField(request.body, "displayName").trim();
    if (!displayName) {
      response
        .status(400)
        .json({ ok: false, error: "displayName is required." });
      return;
    }

    try {
      const decoded = await deps.verifyIdToken(bearerToken);
      const profile = await deps.upsertProfile({
        uid: decoded.uid,
        email: decoded.email,
        displayName,
        photoURL:
          readOptionalStringField(request.body, "photoURL") ?? decoded.picture,
      });

      response.status(200).json({ ok: true, profile });
    } catch (error) {
      logger.error("upsertCliProfile failed", error);
      response.status(500).json({
        ok: false,
        error:
          error instanceof Error ? error.message : "CLI profile upsert failed.",
      });
    }
  };
}

export function createUpsertCliProfile(
  deps: Pick<HandlerDeps, "auth" | "db" | "clock">,
) {
  const handler = createUpsertCliProfileHandler({
    verifyIdToken: deps.auth.verifyIdToken,
    upsertProfile: (input) =>
      upsertCliProfileRecord(deps.db, deps.clock.now(), input),
  });
  return onRequest({ region: "us-central1" }, handler);
}

export async function upsertCliProfileRecord(
  db: HandlerDeps["db"],
  now: ReturnType<HandlerDeps["clock"]["now"]>,
  input: {
    uid: string;
    email?: string;
    displayName: string;
    photoURL?: string | null;
  },
): Promise<CliProfileRecord> {
  const ref = db.doc(`users/${input.uid}`);
  const snapshot = await ref.get();
  const existing = snapshot.exists
    ? (snapshot.data() as Partial<CliProfileRecord>)
    : null;
  const displayName =
    input.displayName.trim() || existing?.displayName || "Anonymous";
  const email = (input.email ?? existing?.email ?? "").trim();
  const photoURL = (input.photoURL ?? existing?.photoURL ?? "").trim();

  if (!snapshot.exists) {
    const created = buildUserProfile(
      {
        uid: input.uid,
        displayName,
        email,
        photoURL,
      },
      now,
    );
    await ref.set(created, { merge: true });
    return {
      uid: created.uid,
      displayName: created.displayName,
      email: created.email,
      photoURL: created.photoURL ?? "",
    };
  }

  await ref.set(
    { displayName, email, photoURL },
    { merge: true },
  );

  return {
    uid: input.uid,
    displayName,
    email,
    photoURL,
  };
}
