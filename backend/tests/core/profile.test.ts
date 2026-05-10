import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

import { buildUserProfile } from "@/core/profiles";

const TEST_NOW = Timestamp.fromDate(new Date("2026-05-05T00:00:00Z"));

describe("buildUserProfile", () => {
  it("initializes counters and copies auth fields", () => {
    const profile = buildUserProfile(
      {
        uid: "user-1",
        displayName: "Burst Tester",
        email: "tester@example.com",
        photoURL: "https://example.com/avatar.png",
      },
      TEST_NOW,
    );

    expect(profile.uid).toBe("user-1");
    expect(profile.displayName).toBe("Burst Tester");
    expect(profile.email).toBe("tester@example.com");
    expect(profile.photoURL).toBe("https://example.com/avatar.png");
    expect(profile.uploadCount).toBe(0);
    expect(profile.downloadCount).toBe(0);
    expect(profile.points).toBe(10_000);
    expect(profile.reputation).toBe(0);
    expect(typeof profile.createdAt.toMillis).toBe("function");
  });
});
