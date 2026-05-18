import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";

import { createGetDatasetHandler, executeGetDataset } from "@/handlers/get-dataset";

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
      async () => ({
        dataset: {
          id: "dataset-1",
          ownerUid: "uid-alice",
          ownerName: "Alice",
          title: "Legal Korean Set",
          description: "Korean legal dataset",
          tags: ["domain/legal", "quality:seed"],
          rowCount: 1200,
          likeCount: 5,
          downloadCount: 9,
          status: "active",
        },
        previewSamples: [
          {
            messages: [
              { role: "user", content: "Question" },
              { role: "assistant", content: "Answer" },
            ],
          },
        ],
      }) as never,
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(response.body).toEqual({
      ok: true,
        dataset: {
          id: "dataset-1",
          ownerUid: "uid-alice",
          ownerName: "Alice",
          ownerPhotoURL: "",
        title: "Legal Korean Set",
        description: "Korean legal dataset",
        tags: ["domain/legal", "quality:seed"],
        rowCount: 1200,
        likeCount: 5,
        downloadCount: 9,
        status: "active",
        previewSamples: [
          {
            messages: [
              { role: "user", content: "Question" },
              { role: "assistant", content: "Answer" },
            ],
          },
        ],
      },
    });
  });

  it("uses the public profile display name for uid-backed dataset owners", async () => {
    const response = createResponse();
    const handler = createGetDatasetHandler({
      db: {
        doc: (path: string) => ({
          get: async () => ({
            exists: path === "users/uid-alice",
            data: () => ({
              displayName: "Alice Profile",
              photoURL: "https://example.com/alice.png",
            }),
          }),
        }),
      },
    } as never);

    await handler(
      { method: "GET", query: { datasetId: "dataset-1" }, body: {} },
      response as never,
      async () => ({
        dataset: {
          id: "dataset-1",
          ownerUid: "uid-alice",
          ownerName: "uid-alice",
          title: "Legal Korean Set",
          description: "Korean legal dataset",
          tags: ["domain/legal"],
          rowCount: 1200,
          likeCount: 5,
          downloadCount: 9,
          status: "active",
        },
        previewSamples: [],
      }) as never,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      dataset: {
        ownerUid: "uid-alice",
        ownerName: "Alice Profile",
        ownerPhotoURL: "https://example.com/alice.png",
      },
    });
  });

  it("reads limited preview samples from the normalized dataset object", async () => {
    const jsonl = [
      JSON.stringify({
        messages: [
          { role: "user", content: "q1" },
          { role: "assistant", content: "a1" },
        ],
      }),
      JSON.stringify({
        messages: [
          { role: "user", content: "q2" },
          { role: "assistant", content: "a2" },
        ],
      }),
      JSON.stringify({
        messages: [
          { role: "user", content: "q3" },
          { role: "assistant", content: "a3" },
        ],
      }),
      JSON.stringify({
        messages: [
          { role: "user", content: "q4" },
          { role: "assistant", content: "a4" },
        ],
      }),
    ].join("\n");

    const detail = await executeGetDataset(
      {
        db: {
          doc: () => ({
            get: async () => ({
              exists: true,
              id: "dataset-1",
              data: () => ({
                id: "dataset-1",
                ownerUid: "uid-alice",
                ownerName: "Alice",
                title: "Legal Korean Set",
                description: "Korean legal dataset",
                tags: ["domain/legal"],
                rowCount: 4,
                likeCount: 5,
                downloadCount: 9,
                status: "active",
                storagePath: "gs://datasets-bucket/uploads/dataset-1.jsonl",
                normalizedStoragePath: "normalized/dataset-1/dataset.jsonl",
              }),
            }),
          }),
        },
        storage: {
          bucket: (bucketName: string) => ({
            file: (path: string) => ({
              createReadStream: () => {
                expect(bucketName).toBe("datasets-bucket");
                expect(path).toBe("normalized/dataset-1/dataset.jsonl");
                return Readable.from([jsonl]);
              },
            }),
          }),
        },
      } as never,
      "dataset-1",
    );

    expect(detail?.previewSamples).toHaveLength(3);
    expect(detail?.previewSamples[0].messages[0]).toEqual({
      role: "user",
      content: "q1",
    });
  });
});
