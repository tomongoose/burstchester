import { describe, expect, it } from "vitest";

import { createIssueAccessTokenHandler } from "@/handlers/issue-access-token";

interface ResponseStub {
  statusCode: number;
  body: unknown;
  status(code: number): ResponseStub;
  json(payload: unknown): ResponseStub;
}

function createResponse(): ResponseStub {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("issueAccessTokenHandler", () => {
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

    await handler({ headers: {}, body: {} }, response as never);

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
