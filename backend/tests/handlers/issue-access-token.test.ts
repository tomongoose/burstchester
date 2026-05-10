import { describe, expect, it } from "vitest";

import { createIssueAccessTokenHandler } from "@/handlers/issue-access-token";

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

describe("issueAccessTokenHandler", () => {
  it("answers browser preflight requests", async () => {
    const response = createResponse();
    const handler = createIssueAccessTokenHandler({
      verifyIdToken: async () => {
        throw new Error("should not verify");
      },
      issueAccessToken: async () => {
        throw new Error("should not issue");
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

  it("requires a Firebase bearer token", async () => {
    const response = createResponse();
    const handler = createIssueAccessTokenHandler({
      verifyIdToken: async () => {
        throw new Error("should not verify");
      },
      issueAccessToken: async () => {
        throw new Error("should not issue");
      },
    });

    await handler({ method: "POST", headers: {}, body: {} }, response as never);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ ok: false, error: "Missing bearer token." });
  });

  it("issues an access token for the authenticated user", async () => {
    const response = createResponse();
    const issued: Array<{ uid: string; label: string }> = [];
    const handler = createIssueAccessTokenHandler({
      verifyIdToken: async () => ({ uid: "user-1" }),
      issueAccessToken: async (input) => {
        issued.push(input);
        return {
          token: "bst_token-id_secret-value",
          tokenId: "token-id",
        };
      },
    });

    await handler(
      {
        headers: { authorization: "Bearer firebase-id-token" },
        method: "POST",
        body: { label: "Colab" },
      },
      response as never,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      token: "bst_token-id_secret-value",
      tokenId: "token-id",
    });
    expect(issued).toEqual([{ uid: "user-1", label: "Colab" }]);
  });
});
