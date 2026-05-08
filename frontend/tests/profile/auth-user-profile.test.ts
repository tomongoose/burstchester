import { describe, expect, it } from "vitest";

import { buildProfileCardDataFromAuthUser } from "@/lib/profile/auth-user-profile";

describe("buildProfileCardDataFromAuthUser", () => {
  it("builds displayable profile data without requiring Firestore reads", () => {
    expect(
      buildProfileCardDataFromAuthUser({
        uid: "user-1",
        displayName: "Alice",
        email: "alice@example.com",
        photoURL: "https://example.com/a.png",
      }),
    ).toEqual({
      uid: "user-1",
      displayName: "Alice",
      email: "alice@example.com",
      photoURL: "https://example.com/a.png",
      uploadCount: 0,
      downloadCount: 0,
      reputation: 0,
    });
  });

  it("labels anonymous users clearly", () => {
    expect(
      buildProfileCardDataFromAuthUser({
        uid: "anon-1",
        displayName: null,
        email: null,
        photoURL: null,
        isAnonymous: true,
      }).displayName,
    ).toBe("Anonymous");
  });
});
