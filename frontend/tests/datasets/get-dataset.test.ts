import { describe, expect, it, vi } from "vitest";

import { fetchDatasetSummaryById } from "@/lib/datasets/get-dataset";

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
    );
    expect(summary?.id).toBe("dataset-1");
    expect(summary?.size.category).toBe("medium");
  });
});
