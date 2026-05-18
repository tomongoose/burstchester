import { describe, it, expect } from "vitest";

import { createUpsertCliProfileHandler } from "@/handlers/upsert-cli-profile";

interface ResponseStub {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status(code: number): ResponseStub;
  json(payload: unknown): ResponseStub;
  send(payload?: unknown): ResponseStub;
  setHeader(name: string, value: string): void;
}

function createResponse(): ResponseStub {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
}

describe("upsertCliProfileHandler", () => {
  it("answers browser preflight requests", async () => {
    const response = createResponse();

    const handler = createUpsertCliProfileHandler({
      verifyIdToken: async () => {
        throw new Error("should not be called");
      },
      upsertProfile: async () => {
        throw new Error("should not be called");
      },
      getProfile: async () => {
        throw new Error("should not be called");
      },
    });

    await handler(
      { method: "OPTIONS", headers: {}, body: {} },
      response as never,
    );

    expect(response.statusCode).toBe(204);
    expect(response.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(response.headers["Access-Control-Allow-Headers"]).toContain("Authorization");
  });

  it("rejects requests without bearer token", async () => {
    const response = createResponse();

    const handler = createUpsertCliProfileHandler({
      verifyIdToken: async () => {
        throw new Error("should not be called");
      },
      upsertProfile: async () => {
        throw new Error("should not be called");
      },
      getProfile: async () => {
        throw new Error("should not be called");
      },
    });

    await handler(
      { method: "POST", headers: {}, body: { displayName: "Alice" } },
      response as never,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: "Missing bearer token.",
    });
  });

  it("upserts profile from verified token", async () => {
    const response = createResponse();
    const verifiedTokens: string[] = [];

    const handler = createUpsertCliProfileHandler({
      verifyIdToken: async (idToken) => {
        verifiedTokens.push(idToken);
        return {
          uid: "u-alice",
          email: "alice@example.com",
        };
      },
      upsertProfile: async ({ uid, email, displayName, photoURL, description, workplace }) => ({
        uid,
        email: email ?? "",
        displayName,
        photoURL: photoURL ?? "",
        description: description ?? "",
        workplace: workplace ?? "",
        uploadCount: 0,
        downloadCount: 0,
        points: 10_000,
        reputation: 0,
      }),
      getProfile: async () => {
        throw new Error("should not get");
      },
    });

    await handler(
      {
        headers: { authorization: "Bearer firebase-id-token" },
        method: "POST",
        body: {
          displayName: "Alice",
          photoURL: "https://example.com/p.png",
          description: "Building useful datasets.",
          workplace: "Burst Labs",
        },
      },
      response as never,
    );

    expect(verifiedTokens).toEqual(["firebase-id-token"]);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      profile: {
        uid: "u-alice",
        email: "alice@example.com",
        displayName: "Alice",
        photoURL: "https://example.com/p.png",
        description: "Building useful datasets.",
        workplace: "Burst Labs",
        uploadCount: 0,
        downloadCount: 0,
        points: 10_000,
        reputation: 0,
      },
    });
  });

  it("returns the authenticated user's profile on GET", async () => {
    const response = createResponse();
    const handler = createUpsertCliProfileHandler({
      verifyIdToken: async () => ({
        uid: "u-alice",
        email: "alice@example.com",
        name: "Alice",
        picture: "https://example.com/google.png",
      }),
      upsertProfile: async () => {
        throw new Error("should not upsert");
      },
      getProfile: async ({ uid, email, displayName, photoURL }) => ({
        uid,
        email: email ?? "",
        displayName: displayName ?? "",
        photoURL: photoURL ?? "",
        description: "Hello",
        workplace: "Acme",
        uploadCount: 2,
        downloadCount: 3,
        points: 9_750,
        reputation: 4,
      }),
    });

    await handler(
      {
        headers: { authorization: "Bearer firebase-id-token" },
        method: "GET",
        query: {},
        body: {},
      },
      response as never,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      profile: {
        uid: "u-alice",
        email: "alice@example.com",
        displayName: "Alice",
        photoURL: "https://example.com/google.png",
        description: "Hello",
        workplace: "Acme",
        uploadCount: 2,
        downloadCount: 3,
        points: 9_750,
        reputation: 4,
      },
    });
  });

  it("returns a public profile without email for a non-anonymous target user", async () => {
    const response = createResponse();
    const handler = createUpsertCliProfileHandler({
      verifyIdToken: async () => ({ uid: "viewer" }),
      upsertProfile: async () => {
        throw new Error("should not upsert");
      },
      getProfile: async ({ uid, requesterUid }) => ({
        uid,
        email: requesterUid === uid ? "owner@example.com" : "",
        displayName: "Alice",
        photoURL: "https://example.com/alice.png",
        description: "Public profile",
        workplace: "Acme",
        uploadCount: 2,
        downloadCount: 3,
        points: 9_750,
        reputation: 4,
      }),
    });

    await handler(
      {
        headers: { authorization: "Bearer firebase-id-token" },
        method: "GET",
        query: { uid: "owner" },
        body: {},
      },
      response as never,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      profile: {
        uid: "owner",
        email: "",
        displayName: "Alice",
        photoURL: "https://example.com/alice.png",
        description: "Public profile",
        workplace: "Acme",
        uploadCount: 2,
        downloadCount: 3,
        points: 9_750,
        reputation: 4,
      },
    });
  });

  it("returns an anonymous target profile without granting edit access", async () => {
    const response = createResponse();
    const handler = createUpsertCliProfileHandler({
      verifyIdToken: async () => ({ uid: "viewer" }),
      upsertProfile: async () => {
        throw new Error("should not upsert");
      },
      getProfile: async ({ uid, requesterUid }) => ({
        uid,
        email: requesterUid === uid ? "owner@example.com" : "",
        displayName: "Anonymous",
        photoURL: "",
        description: "",
        workplace: "",
        uploadCount: 0,
        downloadCount: 0,
        points: 10_000,
        reputation: 0,
      }),
    });

    await handler(
      {
        headers: { authorization: "Bearer firebase-id-token" },
        method: "GET",
        query: { uid: "anonymous-owner" },
        body: {},
      },
      response as never,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      profile: {
        uid: "anonymous-owner",
        email: "",
        displayName: "Anonymous",
        photoURL: "",
        description: "",
        workplace: "",
        uploadCount: 0,
        downloadCount: 0,
        points: 10_000,
        reputation: 0,
      },
    });
  });

  it("rejects unsupported methods", async () => {
    const response = createResponse();
    const handler = createUpsertCliProfileHandler({
      verifyIdToken: async () => ({ uid: "u-alice" }),
      upsertProfile: async () => {
        throw new Error("should not upsert");
      },
      getProfile: async () => {
        throw new Error("should not get");
      },
    });

    await handler(
      {
        headers: { authorization: "Bearer firebase-id-token" },
        method: "DELETE",
        query: {},
        body: {},
      },
      response as never,
    );

    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({
      ok: false,
      error: "Method not allowed.",
    });
  });
});
