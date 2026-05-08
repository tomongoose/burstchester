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
      upsertProfile: async ({ uid, email, displayName, photoURL }) => ({
        uid,
        email: email ?? "",
        displayName,
        photoURL: photoURL ?? "",
      }),
    });

    await handler(
      {
        headers: { authorization: "Bearer firebase-id-token" },
        method: "POST",
        body: {
          displayName: "Alice",
          photoURL: "https://example.com/p.png",
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
      },
    });
  });
});
