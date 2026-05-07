import { describe, expect, it, vi } from "vitest";

import { fetchDatasetSummaries } from "@/lib/datasets/list-datasets";
import { SearchFilter } from "@/lib/domain/search-filter";

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
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("language=ko");
    expect(url).toContain("task=instruction");
    expect(url).toContain("baseModel=qwen3%3A14b");
    expect(url).toContain("tags=domain%2Flegal%2Cquality%3Aseed");
    expect(url).toContain("sort=newest");

    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe("dataset-1");
    expect(summaries[0].size.category).toBe("medium");
    expect(summaries[0].description.endsWith("…")).toBe(true);
  });
});
