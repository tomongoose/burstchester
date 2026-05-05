import { describe, expect, it } from "vitest";
import { UserProfile } from "@/lib/domain/user";

describe("UserProfile", () => {
  it("rejects empty displayName", () => {
    expect(() =>
      UserProfile.create("", "alice@example.com", "https://example.com/avatar.png"),
    ).toThrow(/displayName/i);
  });

  it("rejects invalid email", () => {
    expect(() =>
      UserProfile.create("Alice", "not-an-email", "https://example.com/avatar.png"),
    ).toThrow(/email/i);
  });

  it("does not throw when photoURL is null (Google profiles may omit it)", () => {
    expect(() => UserProfile.create("Alice", "alice@example.com", null)).not.toThrow();
  });

  it("rejects non-https photoURL", () => {
    expect(() =>
      UserProfile.create("Alice", "alice@example.com", "http://insecure.example/p.png"),
    ).toThrow(/photoURL/i);
  });
});
