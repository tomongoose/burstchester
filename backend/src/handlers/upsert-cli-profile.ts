import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import { buildUserProfile } from "../core/profiles";
import { INITIAL_USER_POINTS } from "../core/purchases";
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
  readonly description: string;
  readonly workplace: string;
  readonly uploadCount: number;
  readonly downloadCount: number;
  readonly points: number;
  readonly reputation: number;
}

export interface UpsertCliProfileHandlerDeps {
  readonly verifyIdToken: HandlerDeps["auth"]["verifyIdToken"];
  readonly upsertProfile: (input: {
    uid: string;
    email?: string;
    displayName: string;
    photoURL?: string | null;
    description?: string | null;
    workplace?: string | null;
  }) => Promise<CliProfileRecord>;
  readonly getProfile: (input: {
    uid: string;
    requesterUid: string;
    email?: string;
    displayName?: string | null;
    photoURL?: string | null;
  }) => Promise<CliProfileRecord>;
}

export function createUpsertCliProfileHandler(
  deps: UpsertCliProfileHandlerDeps,
) {
  return async function handleUpsertCliProfile(
    request: Pick<Request, "method" | "headers" | "body"> & Partial<Pick<Request, "query">>,
    response: Response,
  ): Promise<void> {
    applyCors(response);
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
      if (request.method === "GET") {
        const targetUid = readQueryString(request, "uid");
        const profile = await deps.getProfile({
          uid: targetUid || decoded.uid,
          requesterUid: decoded.uid,
          email: targetUid ? "" : decoded.email,
          displayName: targetUid ? "" : decoded.name,
          photoURL: targetUid ? "" : decoded.picture,
        });
        response.status(200).json({ ok: true, profile });
        return;
      }

      if (request.method !== "POST") {
        response.status(405).json({ ok: false, error: "Method not allowed." });
        return;
      }

      const displayName = readStringField(request.body, "displayName").trim();
      if (!displayName) {
        response
          .status(400)
          .json({ ok: false, error: "displayName is required." });
        return;
      }

      const profile = await deps.upsertProfile({
        uid: decoded.uid,
        email: decoded.email,
        displayName,
        photoURL:
          readOptionalStringField(request.body, "photoURL") ?? decoded.picture,
        description: readOptionalStringField(request.body, "description"),
        workplace: readOptionalStringField(request.body, "workplace"),
      });

      response.status(200).json({ ok: true, profile });
    } catch (error) {
      logger.error("upsertCliProfile failed", error);
      if (error instanceof Error && error.message === "Profile is not public.") {
        response.status(403).json({ ok: false, error: error.message });
        return;
      }
      response.status(500).json({
        ok: false,
        error:
          error instanceof Error ? error.message : "CLI profile upsert failed.",
      });
    }
  };
}

function applyCors(response: Pick<Response, "setHeader">): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function createUpsertCliProfile(
  deps: Pick<HandlerDeps, "auth" | "db" | "clock">,
) {
  const handler = createUpsertCliProfileHandler({
    verifyIdToken: deps.auth.verifyIdToken,
    upsertProfile: (input) =>
      upsertCliProfileRecord(deps.db, deps.clock.now(), input),
    getProfile: (input) =>
      getOrCreateCliProfileRecord(deps.db, deps.clock.now(), input),
  });
  return onRequest({ region: "us-central1" }, handler);
}

export async function upsertCliProfileRecord(
  db: HandlerDeps["db"],
  now: ReturnType<HandlerDeps["clock"]["now"]>,
  input: {
    uid: string;
    requesterUid?: string;
    email?: string;
    displayName: string;
    photoURL?: string | null;
    description?: string | null;
    workplace?: string | null;
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
  const description = (input.description ?? existing?.description ?? "").trim();
  const workplace = (input.workplace ?? existing?.workplace ?? "").trim();

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
      description: created.description,
      workplace: created.workplace,
      uploadCount: created.uploadCount,
      downloadCount: created.downloadCount,
      points: created.points,
      reputation: created.reputation,
    };
  }

  await ref.set(
    { displayName, email, photoURL, description, workplace },
    { merge: true },
  );

  return {
    uid: input.uid,
    displayName,
    email,
    photoURL,
    description,
    workplace,
    uploadCount: Number(existing?.uploadCount ?? 0),
    downloadCount: Number(existing?.downloadCount ?? 0),
    points: Number(existing?.points ?? INITIAL_USER_POINTS),
    reputation: Number(existing?.reputation ?? 0),
  };
}

export async function getOrCreateCliProfileRecord(
  db: HandlerDeps["db"],
  now: ReturnType<HandlerDeps["clock"]["now"]>,
  input: {
    uid: string;
    requesterUid?: string;
    email?: string;
    displayName?: string | null;
    photoURL?: string | null;
  },
): Promise<CliProfileRecord> {
  const ref = db.doc(`users/${input.uid}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return upsertCliProfileRecord(db, now, {
      uid: input.uid,
      email: input.email,
      displayName: input.displayName?.trim() || "Anonymous",
      photoURL: input.photoURL,
    });
  }

  const existing = snapshot.data() as Partial<CliProfileRecord>;
  const isOwnProfile = !input.requesterUid || input.requesterUid === input.uid;
  const displayName =
    (existing.displayName ?? input.displayName ?? "Anonymous").trim()
    || "Anonymous";

  return {
    uid: input.uid,
    displayName,
    email: isOwnProfile ? (existing.email ?? input.email ?? "").trim() : "",
    photoURL: (existing.photoURL ?? input.photoURL ?? "").trim(),
    description: (existing.description ?? "").trim(),
    workplace: (existing.workplace ?? "").trim(),
    uploadCount: Number(existing.uploadCount ?? 0),
    downloadCount: Number(existing.downloadCount ?? 0),
    points: Number(existing.points ?? INITIAL_USER_POINTS),
    reputation: Number(existing.reputation ?? 0),
  };
}

function readQueryString(
  request: Partial<Pick<Request, "query">>,
  key: string,
): string {
  const value = request.query?.[key];
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first.trim() : "";
}
