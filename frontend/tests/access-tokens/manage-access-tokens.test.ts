import { describe, expect, it, vi } from "vitest";

import {
  deleteAccessTokenForUser,
  listAccessTokensForUser,
} from "@/lib/access-tokens/manage-access-tokens";

describe("access token management requests", () => {
  it("loads access tokens with the user's Firebase token", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({
        ok: true,
        tokens: [
          {
            id: "token-id",
            label: "Colab",
            createdAt: "2026-05-09T00:00:00.000Z",
          },
        ],
      }),
      { status: 200 },
    ));
    const user = { getIdToken: vi.fn(async () => "firebase-id-token") };

    const tokens = await listAccessTokensForUser({
      user,
      endpointUrl: "https://functions.example/listAccessTokens",
      fetchImpl,
    });

    expect(tokens).toEqual([
      {
        id: "token-id",
        label: "Colab",
        createdAt: "2026-05-09T00:00:00.000Z",
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://functions.example/listAccessTokens",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer firebase-id-token",
          Accept: "application/json",
        },
      },
    );
  });

  it("deletes an access token under the user's Firebase token", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, tokenId: "token-id" }),
      { status: 200 },
    ));
    const user = { getIdToken: vi.fn(async () => "firebase-id-token") };

    await deleteAccessTokenForUser({
      user,
      tokenId: "token-id",
      endpointUrl: "https://functions.example/revokeAccessToken",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://functions.example/revokeAccessToken",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer firebase-id-token",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ tokenId: "token-id" }),
      },
    );
  });
});
