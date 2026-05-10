import { describe, expect, it, vi } from "vitest";

import { validateRestoredLoginUser } from "@/lib/auth/restored-session";

describe("validateRestoredLoginUser", () => {
  it("accepts a non-anonymous cached user after token validation succeeds", async () => {
    const user = {
      uid: "google-user",
      isAnonymous: false,
      getIdToken: vi.fn(async () => "id-token"),
    };

    await expect(
      validateRestoredLoginUser(user),
    ).resolves.toBe(user);
  });

  it("rejects anonymous users", async () => {
    const getIdToken = vi.fn(async () => "anonymous-token");

    await expect(
      validateRestoredLoginUser({
        uid: "anon-user",
        isAnonymous: true,
        getIdToken,
      }),
    ).resolves.toBeNull();
    expect(getIdToken).not.toHaveBeenCalled();
  });

  it("rejects users whose cached token cannot be validated", async () => {
    await expect(
      validateRestoredLoginUser({
        uid: "expired-user",
        isAnonymous: false,
        getIdToken: vi.fn(async () => {
          throw new Error("auth expired");
        }),
      }),
    ).rejects.toThrow(/auth expired/i);
  });
});
