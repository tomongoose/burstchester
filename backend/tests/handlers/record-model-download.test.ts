import { describe, expect, it } from "vitest";

import { createRecordModelDownloadHandler } from "@/handlers/record-model-download";

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

describe("recordModelDownloadHandler", () => {
  it("requires a bearer token", async () => {
    const response = createResponse();
    const handler = createRecordModelDownloadHandler({
      verifyIdToken: async () => {
        throw new Error("should not verify");
      },
      recordModelDownload: async () => {
        throw new Error("should not record");
      },
    });

    await handler({ headers: {}, body: { modelName: "Qwen/Qwen3-0.6B" } }, response as never);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ ok: false, error: "Missing bearer token." });
  });

  it("charges points and stores the paid model name", async () => {
    const response = createResponse();
    const records: Array<{ uid: string; modelName: string; sourceUrl: string }> = [];
    const handler = createRecordModelDownloadHandler({
      verifyIdToken: async () => ({ uid: "user-1" }),
      recordModelDownload: async (input) => {
        records.push(input);
        return { pointCost: 100, remainingPoints: 9_900 };
      },
    });

    await handler(
      {
        headers: { authorization: "Bearer token" },
        body: {
          modelName: "Qwen/Qwen3-0.6B",
          sourceUrl: "https://huggingface.co/Qwen/Qwen3-0.6B/resolve/main/model.gguf",
        },
      },
      response as never,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      modelName: "Qwen/Qwen3-0.6B",
      pointCost: 100,
      remainingPoints: 9_900,
    });
    expect(records).toEqual([
      {
        uid: "user-1",
        modelName: "Qwen/Qwen3-0.6B",
        sourceUrl: "https://huggingface.co/Qwen/Qwen3-0.6B/resolve/main/model.gguf",
      },
    ]);
  });
});
