import { describe, expect, it, vi } from "vitest";

import { issueAccessTokenForUser } from "@/lib/access-tokens/issue-access-token";

describe("issueAccessTokenForUser", () => {
  it("posts the user's Firebase token and requested label to issueAccessToken", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({
        ok: true,
        token: "bst_token-id_secret",
        tokenId: "token-id",
      }),
      { status: 200 },
    ));
    const user = {
      getIdToken: vi.fn(async () => "firebase-id-token"),
    };

    const issued = await issueAccessTokenForUser({
      user,
      label: "Colab run",
      fetchImpl,
      endpointUrl: "https://functions.example/issueAccessToken",
    });

    expect(issued).toEqual({
      token: "bst_token-id_secret",
      tokenId: "token-id",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://functions.example/issueAccessToken",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer firebase-id-token",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ label: "Colab run" }),
      },
    );
  });
});
