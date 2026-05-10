import { describe, expect, it, vi } from "vitest";

import { getOrCreateAccessTokenUser } from "@/lib/access-tokens/anonymous-token-user";

describe("getOrCreateAccessTokenUser", () => {
  it("returns the current user when one is already signed in", async () => {
    const currentUser = { getIdToken: async () => "google-id-token" };
    const auth = { currentUser };
    const signInAnonymously = vi.fn();

    await expect(
      getOrCreateAccessTokenUser({ auth, signInAnonymously }),
    ).resolves.toBe(currentUser);
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("creates an anonymous Firebase user when signed out", async () => {
    const anonymousUser = { getIdToken: async () => "anon-id-token" };
    const signInAnonymously = vi.fn(async () => ({ user: anonymousUser }));

    await expect(
      getOrCreateAccessTokenUser({
        auth: { currentUser: null },
        signInAnonymously,
      }),
    ).resolves.toBe(anonymousUser);
  });
});
