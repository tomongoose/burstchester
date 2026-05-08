import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

import {
  createListModelsHandler,
  toModelSummaryRecord,
} from "@/handlers/list-models";
import type { ModelRecord } from "@/core/model-registry";

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

describe("listModelsHandler", () => {
  it("requires a bearer token before listing models", async () => {
    const response = createResponse();
    const handler = createListModelsHandler({
      verifyIdToken: async () => {
        throw new Error("should not verify");
      },
      listModels: async () => {
        throw new Error("should not list");
      },
    });

    await handler({ method: "GET", headers: {}, query: {} }, response as never);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ ok: false, error: "Missing bearer token." });
  });

  it("returns model summaries for authenticated users", async () => {
    const response = createResponse();
    const handler = createListModelsHandler({
      verifyIdToken: async () => ({ uid: "user-1" }),
      listModels: async () => [
        {
          id: "model-1",
          ownerUid: "user-1",
          ownerName: "",
          baseModel: "google/gemma-3",
          trainingDatasets: ["dataset-1"],
          trainingMethod: "lora",
          ollamaPullUrl: null,
          huggingFaceUrl: "https://huggingface.co/org/model/resolve/main/model.gguf",
          pointCost: 100,
          createdAt: "1970-01-01T00:00:01.000Z",
          updatedAt: "1970-01-01T00:00:02.000Z",
        },
      ],
    });

    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer firebase-id-token" },
        query: { sort: "newest" },
      },
      response as never,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      models: [
        {
          id: "model-1",
          ownerUid: "user-1",
          ownerName: "",
          baseModel: "google/gemma-3",
          trainingDatasets: ["dataset-1"],
          trainingMethod: "lora",
          huggingFaceUrl: "https://huggingface.co/org/model/resolve/main/model.gguf",
          ollamaPullUrl: null,
          pointCost: 100,
          createdAt: "1970-01-01T00:00:01.000Z",
          updatedAt: "1970-01-01T00:00:02.000Z",
        },
      ],
    });
  });

  it("serializes model timestamps for frontend rendering", () => {
    const record: ModelRecord = {
      id: "model-1",
      ownerUid: "user-1",
      baseModel: "Qwen/Qwen3-0.6B",
      trainingDatasets: ["dataset-1", "dataset-2"],
      trainingMethod: "qlora",
      evalReports: [],
      ollamaPullUrl: "ollama pull burstchester/model-1",
      huggingFaceUrl: "https://huggingface.co/org/model/resolve/main/model.gguf",
      pointCost: 120,
      createdAt: Timestamp.fromMillis(1_000),
      updatedAt: Timestamp.fromMillis(2_000),
    };

    expect(toModelSummaryRecord(record)).toMatchObject({
      id: "model-1",
      ownerName: "",
      trainingDatasets: ["dataset-1", "dataset-2"],
      createdAt: "1970-01-01T00:00:01.000Z",
      updatedAt: "1970-01-01T00:00:02.000Z",
    });
  });
});
