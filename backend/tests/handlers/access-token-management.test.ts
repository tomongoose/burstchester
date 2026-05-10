import { describe, expect, it } from "vitest";

import {
  createListAccessTokensHandler,
  createRevokeAccessTokenHandler,
} from "@/handlers/access-token-management";

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

describe("access token management handlers", () => {
  it("lists tokens for the authenticated user", async () => {
    const response = createResponse();
    const listedUids: string[] = [];
    const handler = createListAccessTokensHandler({
      verifyIdToken: async () => ({ uid: "user-1" }),
      listAccessTokens: async (uid) => {
        listedUids.push(uid);
        return [
          {
            id: "token-1",
            label: "Colab",
            createdAt: "2026-05-09T00:00:00.000Z",
          },
        ];
      },
    });

    await handler(
      { method: "GET", headers: { authorization: "Bearer firebase-id-token" } },
      response as never,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      tokens: [
        {
          id: "token-1",
          label: "Colab",
          createdAt: "2026-05-09T00:00:00.000Z",
        },
      ],
    });
    expect(listedUids).toEqual(["user-1"]);
  });

  it("revokes a token under the authenticated user", async () => {
    const response = createResponse();
    const revoked: Array<{ uid: string; tokenId: string }> = [];
    const handler = createRevokeAccessTokenHandler({
      verifyIdToken: async () => ({ uid: "user-1" }),
      revokeAccessToken: async (uid, tokenId) => {
        revoked.push({ uid, tokenId });
      },
    });

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer firebase-id-token" },
        body: { tokenId: "token-1" },
      },
      response as never,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true, tokenId: "token-1" });
    expect(revoked).toEqual([{ uid: "user-1", tokenId: "token-1" }]);
  });
});
