import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

import { createGetModelHandler } from "@/handlers/get-model";

interface ResponseStub {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status(code: number): ResponseStub;
  json(payload: unknown): ResponseStub;
  send(payload?: unknown): ResponseStub;
  setHeader(name: string, value: string): void;
}

function createResponse(): ResponseStub {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
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
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
}

describe("getModelHandler", () => {
  it("requires a bearer token before loading a model", async () => {
    const response = createResponse();
    const handler = createGetModelHandler({
      auth: {
        verifyIdToken: async () => {
          throw new Error("should not verify");
        },
      },
      db: {} as never,
    });

    await handler(
      { method: "GET", headers: {}, query: { modelId: "model-1" }, body: {} },
      response as never,
      async () => null,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ ok: false, error: "Missing bearer token." });
  });

  it("returns 404 when the model does not exist", async () => {
    const response = createResponse();
    const handler = createGetModelHandler({
      auth: { verifyIdToken: async () => ({ uid: "viewer" }) },
      db: {} as never,
    });

    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer firebase-id-token" },
        query: { modelId: "missing" },
        body: {},
      },
      response as never,
      async () => null,
    );

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ ok: false, error: "Model not found." });
  });

  it("returns a public model summary payload", async () => {
    const response = createResponse();
    const handler = createGetModelHandler({
      auth: { verifyIdToken: async () => ({ uid: "viewer" }) },
      db: {
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({ displayName: "Alice" }),
          }),
        }),
      } as never,
    });

    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer firebase-id-token" },
        query: { modelId: "model-1" },
        body: {},
      },
      response as never,
      async () => ({
        id: "model-1",
        ownerUid: "uid-alice",
        title: "Legal Ko LoRA",
        baseModel: "google/gemma-2-2b",
        trainingDatasets: ["dataset-1"],
        trainingMethod: "qlora",
        evalReports: [],
        ollamaPullUrl: null,
        huggingFaceUrl: "https://huggingface.co/org/model/resolve/main/model.gguf",
        pointCost: 100,
        createdAt: Timestamp.fromMillis(1_000),
        updatedAt: Timestamp.fromMillis(2_000),
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      model: {
        id: "model-1",
        ownerUid: "uid-alice",
        title: "Legal Ko LoRA",
        ownerName: "Alice",
        baseModel: "google/gemma-2-2b",
        trainingDatasets: ["dataset-1"],
        trainingMethod: "qlora",
        huggingFaceUrl: "https://huggingface.co/org/model/resolve/main/model.gguf",
        ollamaPullUrl: null,
        pointCost: 100,
        createdAt: "1970-01-01T00:00:01.000Z",
        updatedAt: "1970-01-01T00:00:02.000Z",
      },
    });
  });
});
