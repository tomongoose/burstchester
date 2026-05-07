import { describe, expect, it } from "vitest";

import { createGetDatasetHandler } from "@/handlers/get-dataset";

interface ResponseStub {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  setHeader(name: string, value: string): ResponseStub;
  status(code: number): ResponseStub;
  json(payload: unknown): ResponseStub;
  send(payload?: unknown): ResponseStub;
}

function createResponse(): ResponseStub {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
}

const STUB_DEPS = {} as Parameters<typeof createGetDatasetHandler>[0];

describe("getDatasetHandler", () => {
  it("returns 400 when datasetId is missing", async () => {
    const response = createResponse();
    let called = false;
    const handler = createGetDatasetHandler(STUB_DEPS);

    await handler(
      { method: "GET", query: {}, body: {} },
      response as never,
      async () => {
        called = true;
        return null as never;
      },
    );

    expect(called).toBe(false);
    expect(response.statusCode).toBe(400);
  });

  it("returns 404 when dataset does not exist", async () => {
    const response = createResponse();
    const handler = createGetDatasetHandler(STUB_DEPS);

    await handler(
      { method: "GET", query: { datasetId: "missing" }, body: {} },
      response as never,
      async () => null as never,
    );

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      ok: false,
      error: "Dataset not found.",
    });
  });

  it("returns a public dataset summary payload", async () => {
    const response = createResponse();
    const handler = createGetDatasetHandler(STUB_DEPS);

    await handler(
      { method: "GET", query: { datasetId: "dataset-1" }, body: {} },
      response as never,
      async () =>
        ({
          id: "dataset-1",
          ownerName: "Alice",
          title: "Legal Korean Set",
          description: "Korean legal dataset",
          tags: ["domain/legal", "quality:seed"],
          rowCount: 1200,
          likeCount: 5,
          downloadCount: 9,
          status: "active",
        }) as never,
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(response.body).toEqual({
      ok: true,
      dataset: {
        id: "dataset-1",
        ownerName: "Alice",
        title: "Legal Korean Set",
        description: "Korean legal dataset",
        tags: ["domain/legal", "quality:seed"],
        rowCount: 1200,
        likeCount: 5,
        downloadCount: 9,
        status: "active",
      },
    });
  });
});
