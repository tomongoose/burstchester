import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetDatasetApiAuthTokenCacheForTests,
  getDatasetApiAuthToken,
} from "@/lib/datasets/auth-token";

describe("getDatasetApiAuthToken", () => {
  beforeEach(() => {
    __resetDatasetApiAuthTokenCacheForTests();
  });

  it("requests an anonymous id token from identitytoolkit and caches it", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        idToken: "anon-id-token",
        expiresIn: "3600",
      }),
    }));

    const first = await getDatasetApiAuthToken(fetchMock as never);
    const second = await getDatasetApiAuthToken(fetchMock as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("identitytoolkit.googleapis.com/v1/accounts:signUp");
    expect(init.method).toBe("POST");
    expect(first).toBe("anon-id-token");
    expect(second).toBe("anon-id-token");
  });
});
