import { describe, it, expect } from "vitest";

import {
  createPrepareDatasetDownloadHandler,
  recordDatasetPurchaseIfNeeded,
} from "@/handlers/prepare-dataset-download";

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

const STUB_DEPS = {} as Parameters<typeof createPrepareDatasetDownloadHandler>[0];

describe("prepareDatasetDownloadHandler", () => {
  it("responds to OPTIONS preflight without requiring auth or datasetId", async () => {
    const response = createResponse();
    let called = false;
    const handler = createPrepareDatasetDownloadHandler(STUB_DEPS);

    await handler(
      { method: "OPTIONS", headers: {}, query: {}, body: {} },
      response as never,
      async () => {
        called = true;
        return {} as never;
      },
    );

    expect(called).toBe(false);
    expect(response.statusCode).toBe(204);
    expect(response.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(response.headers["Access-Control-Allow-Methods"]).toBe("GET,OPTIONS");
    expect(response.headers["Access-Control-Allow-Headers"]).toBe(
      "Content-Type, Authorization",
    );
  });

  it("requires authentication before charging points for a dataset download", async () => {
    const response = createResponse();
    const handler = createPrepareDatasetDownloadHandler(STUB_DEPS);

    await handler(
      { method: "GET", headers: {}, query: { datasetId: "dataset-1" }, body: {} },
      response as never,
      async () => {
        throw new Error("should not prepare download");
      },
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: "Missing bearer token.",
    });
  });

  it("returns 400 when datasetId is missing", async () => {
    const response = createResponse();
    let called = false;
    const handler = createPrepareDatasetDownloadHandler(STUB_DEPS);

    await handler(
      { method: "GET", headers: { authorization: "Bearer token" }, query: {}, body: {} },
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
    const paidDownloads: Array<{ uid: string; datasetId: string }> = [];
    const handler = createPrepareDatasetDownloadHandler(STUB_DEPS);

    await handler(
      { method: "GET", headers: { authorization: "Bearer token" }, query: { datasetId: "dataset-1" }, body: {} },
      response as never,
      async (datasetId, uid) => {
        paidDownloads.push({ uid, datasetId });
        return (
        ({
          datasetId,
          cached: false,
          pointsCharged: 100,
          zipPath: "downloads/dataset-1/dataset-1.zip",
          url: "https://signed.example/downloads/dataset-1/dataset-1.zip",
        }) as never
        );
      },
      async () => ({ uid: "user-1" }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(response.headers["Access-Control-Allow-Headers"]).toBe(
      "Content-Type, Authorization",
    );
    expect(response.body).toEqual({
      ok: true,
      datasetId: "dataset-1",
      cached: false,
      pointsCharged: 100,
      zipPath: "downloads/dataset-1/dataset-1.zip",
      url: "https://signed.example/downloads/dataset-1/dataset-1.zip",
    });
    expect(paidDownloads).toEqual([{ uid: "user-1", datasetId: "dataset-1" }]);
  });

  it("accepts a backend-issued access token for dataset downloads", async () => {
    const response = createResponse();
    const paidDownloads: Array<{ uid: string; datasetId: string }> = [];
    const handler = createPrepareDatasetDownloadHandler(STUB_DEPS);

    await handler(
      { method: "GET", headers: { authorization: "Bearer bst_token-id_secret" }, query: { datasetId: "dataset-1" }, body: {} },
      response as never,
      async (datasetId, uid) => {
        paidDownloads.push({ uid, datasetId });
        return ({
          cached: true,
          zipPath: "downloads/dataset-1/dataset-1.zip",
          url: "https://signed.example/dataset-1.zip",
        }) as never;
      },
      async () => ({ uid: "user-from-access-token" }),
    );

    expect(response.statusCode).toBe(200);
    expect(paidDownloads).toEqual([
      { uid: "user-from-access-token", datasetId: "dataset-1" },
    ]);
  });
});

describe("recordDatasetPurchaseIfNeeded", () => {
  it("pays 70 percent of charged dataset points to the uploader", async () => {
    const writes: Array<{ path: string; data: unknown }> = [];
    const purchaseWrites: unknown[] = [];
    const deps = {
      database: {
        ref: () => ({
          get: async () => ({ exists: () => false }),
          set: async (value: unknown) => {
            purchaseWrites.push(value);
          },
        }),
      },
      db: {
        doc: (path: string) => ({ path }),
        runTransaction: async (callback: (transaction: unknown) => Promise<void>) => {
          await callback({
            get: async () => ({ data: () => ({ points: 1_000 }) }),
            set: (ref: { path: string }, data: unknown) => {
              writes.push({ path: ref.path, data });
            },
          });
        },
      },
      fieldValue: {
        serverTimestamp: () => "server-time",
        increment: (delta: number) => ({ increment: delta }),
      },
    };

    const result = await recordDatasetPurchaseIfNeeded(
      deps as never,
      "buyer",
      {
        id: "dataset-1",
        ownerUid: "uploader",
        title: "Dataset",
        pointCost: 10,
      },
      123,
    );

    expect(result).toEqual({ pointCost: 10, remainingPoints: 990 });
    expect(writes).toEqual([
      {
        path: "users/buyer",
        data: { points: 990, updatedAt: "server-time" },
      },
      {
        path: "users/uploader",
        data: { points: { increment: 7 }, updatedAt: "server-time" },
      },
    ]);
    expect(purchaseWrites[0]).toMatchObject({
      type: "dataset",
      datasetId: "dataset-1",
      ownerUid: "uploader",
      pointCost: 10,
      creatorPayoutPoints: 7,
      remainingPoints: 990,
    });
  });
});
