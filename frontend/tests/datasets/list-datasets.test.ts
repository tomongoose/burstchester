import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/datasets/auth-token", () => ({
  getDatasetApiAuthToken: async () => "anon-token",
}));

import {
  __resetDatasetSummaryRequestCacheForTests,
  fetchDatasetSummaries,
  inferFirebaseProjectIdFromHostname,
  resolveDatasetBackendBaseUrl,
} from "@/lib/datasets/list-datasets";
import { SearchFilter } from "@/lib/domain/search-filter";
import { beforeEach } from "vitest";

beforeEach(() => {
  __resetDatasetSummaryRequestCacheForTests();
});

describe("fetchDatasetSummaries", () => {
  it("requests backend dataset summaries with filter and sort query params", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        datasets: [
          {
            id: "dataset-1",
            ownerName: "Alice",
            title: "Legal Korean Set",
            description: "A".repeat(520),
            tags: ["domain/legal", "quality:seed"],
            rowCount: 1000,
            likeCount: 5,
            downloadCount: 12,
            status: "active",
          },
        ],
      }),
    }));

    const summaries = await fetchDatasetSummaries(
      {
        filter: SearchFilter.create({
          language: "ko",
          task: "instruction",
          baseModel: "qwen3:14b",
          tags: ["domain/legal", "quality:seed"],
        }),
        sort: "newest",
      },
      fetchMock as never,
      "https://example.com/listDatasets",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("language=ko");
    expect(url).toContain("task=instruction");
    expect(url).toContain("baseModel=qwen3%3A14b");
    expect(url).toContain("tags=domain%2Flegal%2Cquality%3Aseed");
    expect(url).toContain("sort=newest");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer anon-token",
    );

    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe("dataset-1");
    expect(summaries[0].size.category).toBe("medium");
    expect(summaries[0].description.endsWith("…")).toBe(true);
  });

  it("reuses an in-flight request for identical query params", async () => {
    let resolveFetch: ((value: unknown) => void) | null = null;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const options = {
      filter: SearchFilter.create({ tags: ["quality:seed"] }),
      sort: "popular" as const,
    };

    const first = fetchDatasetSummaries(
      options,
      fetchMock as never,
      "https://example.com/listDatasets",
    );
    const second = fetchDatasetSummaries(
      options,
      fetchMock as never,
      "https://example.com/listDatasets",
    );

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch?.({
      ok: true,
      json: async () => ({ ok: true, datasets: [] }),
    });

    await expect(first).resolves.toEqual([]);
    await expect(second).resolves.toEqual([]);
  });

  it("backs off after a failed request instead of immediately retrying", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("cors"))
      .mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, datasets: [] }),
      });

    const options = {
      filter: SearchFilter.create({ tags: ["quality:seed"] }),
      sort: "popular" as const,
    };

    await expect(
      fetchDatasetSummaries(
        options,
        fetchMock as never,
        "https://example.com/listDatasets",
      ),
    ).resolves.toEqual([]);

    await expect(
      fetchDatasetSummaries(
        options,
        fetchMock as never,
        "https://example.com/listDatasets",
      ),
    ).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not let a persisted failure marker suppress the first retry in a fresh runtime", async () => {
    const cacheKey =
      "burstchester:list-datasets:failed:https://example.com/listDatasets?sort=popular&limit=24";
    window.sessionStorage.setItem(cacheKey, String(Date.now()));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, datasets: [] }),
    });

    await expect(
      fetchDatasetSummaries(
        {
          filter: SearchFilter.create({}),
          sort: "popular",
        },
        fetchMock as never,
        "https://example.com/listDatasets",
      ),
    ).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("resolveDatasetBackendBaseUrl", () => {
  it("infers the Firebase project id from a hosting hostname", () => {
    expect(
      inferFirebaseProjectIdFromHostname("bustchester-e08c3.web.app"),
    ).toBe("bustchester-e08c3");
    expect(
      inferFirebaseProjectIdFromHostname("bustchester-e08c3.firebaseapp.com"),
    ).toBe("bustchester-e08c3");
    expect(inferFirebaseProjectIdFromHostname("example.com")).toBe("");
  });

  it("uses an explicit project id env var when present", () => {
    const originalProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "burstchester-explicit";

    expect(resolveDatasetBackendBaseUrl()).toBe(
      "https://us-central1-burstchester-explicit.cloudfunctions.net",
    );

    if (originalProjectId) {
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = originalProjectId;
    } else {
      delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    }
  });
});
