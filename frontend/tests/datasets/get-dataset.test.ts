import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/datasets/auth-token", () => ({
  getDatasetApiAuthToken: async () => "anon-token",
}));

import {
  __resetDatasetDetailRequestCacheForTests,
  fetchDatasetSummaryById,
} from "@/lib/datasets/get-dataset";

beforeEach(() => {
  __resetDatasetDetailRequestCacheForTests();
});

describe("fetchDatasetSummaryById", () => {
  it("requests backend dataset detail and maps it into a summary", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        dataset: {
          id: "dataset-1",
          ownerName: "Alice",
          title: "Legal Korean Set",
          description: "Dataset",
          tags: ["domain/legal"],
          rowCount: 1000,
          likeCount: 5,
          downloadCount: 9,
          status: "active",
        },
      }),
    }));

    const summary = await fetchDatasetSummaryById(
      "dataset-1",
      fetchMock as never,
      "https://example.com/getDataset",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/getDataset?datasetId=dataset-1",
      {
        headers: {
          Authorization: "Bearer anon-token",
        },
      },
    );
    expect(summary?.id).toBe("dataset-1");
    expect(summary?.size.category).toBe("medium");
  });

  it("backs off after a failed dataset detail request", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("cors"))
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          dataset: {
            id: "dataset-1",
            ownerName: "Alice",
            title: "Legal Korean Set",
            description: "Dataset",
            tags: ["domain/legal"],
            rowCount: 1000,
            likeCount: 5,
            downloadCount: 9,
            status: "active",
          },
        }),
      });

    await expect(
      fetchDatasetSummaryById(
        "dataset-1",
        fetchMock as never,
        "https://example.com/getDataset",
      ),
    ).resolves.toBeNull();

    await expect(
      fetchDatasetSummaryById(
        "dataset-1",
        fetchMock as never,
        "https://example.com/getDataset",
      ),
    ).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
