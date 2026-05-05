import { describe, expect, it } from "vitest";
import { buildInitialProfileDoc } from "@/lib/users/seed";

const ALICE = {
  uid: "u-alice",
  displayName: "Alice",
  email: "alice@example.com",
  photoURL: "https://example.com/avatar.png",
};

const NOW = new Date("2026-05-05T12:00:00Z");

describe("buildInitialProfileDoc", () => {
  it("uses auth user fields verbatim for displayable data", () => {
    const doc = buildInitialProfileDoc(ALICE, NOW);

    expect(doc.uid).toBe("u-alice");
    expect(doc.displayName).toBe("Alice");
    expect(doc.email).toBe("alice@example.com");
    expect(doc.photoURL).toBe("https://example.com/avatar.png");
  });

  it("initializes counters to zero", () => {
    const doc = buildInitialProfileDoc(ALICE, NOW);

    expect(doc.uploadCount).toBe(0);
    expect(doc.downloadCount).toBe(0);
    expect(doc.reputation).toBe(0);
  });

  it("rejects auth user with invalid display name", () => {
    expect(() =>
      buildInitialProfileDoc(
        { ...ALICE, displayName: "" },
        NOW,
      ),
    ).toThrow(/displayName/i);
  });

  it("sets createdAt from the provided clock (no Date.now()) ", () => {
    const fixedNow = new Date("2099-01-01T00:00:00Z");
    const doc = buildInitialProfileDoc(ALICE, fixedNow);

    expect(doc.createdAt).toBe(fixedNow);
  });
});
