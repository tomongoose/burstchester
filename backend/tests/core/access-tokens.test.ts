import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

import {
  buildUserAccessToken,
  verifyUserAccessToken,
} from "@/core/access-tokens";

const TEST_NOW = Timestamp.fromDate(new Date("2026-05-09T00:00:00Z"));

describe("user access tokens", () => {
  it("returns a raw token once while storing only the secret hash", () => {
    const result = buildUserAccessToken(
      {
        uid: "user-1",
        label: "Colab",
      },
      () => "token-id",
      () => "secret-value",
      TEST_NOW,
    );

    expect(result.token).toBe("bst_token-id_secret-value");
    expect(result.record.id).toBe("token-id");
    expect(result.record.ownerUid).toBe("user-1");
    expect(result.record.label).toBe("Colab");
    expect(result.record.secretHash).not.toContain("secret-value");
  });

  it("verifies a matching token against the stored hash", async () => {
    const issued = buildUserAccessToken(
      { uid: "user-1", label: "" },
      () => "token-id",
      () => "secret-value",
      TEST_NOW,
    );

    const decoded = await verifyUserAccessToken(
      issued.token,
      async () => issued.record,
    );

    expect(decoded.uid).toBe("user-1");
  });
});
