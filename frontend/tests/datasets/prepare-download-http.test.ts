import { describe, expect, it, vi } from "vitest";

import { requestPrepareDownloadHttp } from "@/lib/datasets/prepare-download-http";

describe("requestPrepareDownloadHttp", () => {
  it("requests the HTTP download preparation endpoint and returns the payload", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        datasetId: "dataset-1",
        cached: false,
        zipPath: "downloads/dataset-1/dataset-1.zip",
        url: "https://signed.example/dataset-1.zip",
      }),
    }));

    const result = await requestPrepareDownloadHttp(
      "dataset-1",
      fetchMock as never,
      "https://example.com/prepareDatasetDownload",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/prepareDatasetDownload?datasetId=dataset-1",
      {
        method: "GET",
      },
    );
    expect(result.url).toBe("https://signed.example/dataset-1.zip");
  });
});
