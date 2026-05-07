import { describe, it, expect } from "vitest";

import { createPrepareDatasetDownloadHandler } from "@/handlers/prepare-dataset-download";

interface ResponseStub {
  statusCode: number;
  body: unknown;
  status(code: number): ResponseStub;
  json(payload: unknown): ResponseStub;
}

function createResponse(): ResponseStub {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const STUB_DEPS = {} as Parameters<typeof createPrepareDatasetDownloadHandler>[0];

describe("prepareDatasetDownloadHandler", () => {
  it("returns 400 when datasetId is missing", async () => {
    const response = createResponse();
    let called = false;
    const handler = createPrepareDatasetDownloadHandler(STUB_DEPS);

    await handler(
      { query: {}, body: {} },
      response as never,
      async () => {
        called = true;
        return {} as never;
      },
    );

    expect(called).toBe(false);
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: "datasetId is required.",
    });
  });

  it("returns dataset package metadata", async () => {
    const response = createResponse();
    const handler = createPrepareDatasetDownloadHandler(STUB_DEPS);

    await handler(
      { query: { datasetId: "dataset-1" }, body: {} },
      response as never,
      async (datasetId) =>
        ({
          datasetId,
          cached: false,
          zipPath: "downloads/dataset-1/dataset-1.zip",
          url: "https://signed.example/downloads/dataset-1/dataset-1.zip",
        }) as never,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      datasetId: "dataset-1",
      cached: false,
      zipPath: "downloads/dataset-1/dataset-1.zip",
      url: "https://signed.example/downloads/dataset-1/dataset-1.zip",
    });
  });
});
