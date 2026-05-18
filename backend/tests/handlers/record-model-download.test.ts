import { describe, expect, it } from "vitest";

import {
  createRecordModelDownloadHandler,
  recordModelDownload,
} from "@/handlers/record-model-download";

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

describe("recordModelDownload", () => {
  it("pays 70 percent of charged model points to the model uploader", async () => {
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
    const doc = deps.db.doc;
    deps.db.doc = (path: string) => {
      if (path === "models/model-1") {
        return {
          path,
          get: async () => ({
            exists: true,
            data: () => ({ ownerUid: "uploader", pointCost: 100 }),
          }),
        };
      }
      return doc(path);
    };

    const result = await recordModelDownload(deps as never, {
      uid: "buyer",
      modelName: "model-1",
      sourceUrl: "https://huggingface.co/org/model/resolve/main/model.gguf",
    });

    expect(result).toEqual({ pointCost: 100, remainingPoints: 900 });
    expect(writes).toEqual([
      {
        path: "users/buyer",
        data: { points: 900, updatedAt: "server-time" },
      },
      {
        path: "users/uploader",
        data: { points: { increment: 70 }, updatedAt: "server-time" },
      },
    ]);
    expect(purchaseWrites[0]).toMatchObject({
      type: "model",
      modelName: "model-1",
      ownerUid: "uploader",
      pointCost: 100,
      creatorPayoutPoints: 70,
      remainingPoints: 900,
    });
  });

  it("records Hugging Face repo names without treating slashes as Firestore paths", async () => {
    const requestedDocPaths: string[] = [];
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
        doc: (path: string) => {
          requestedDocPaths.push(path);
          return { path };
        },
        runTransaction: async (callback: (transaction: unknown) => Promise<void>) => {
          await callback({
            get: async () => ({ data: () => ({ points: 1_000 }) }),
            set: () => undefined,
          });
        },
      },
      fieldValue: {
        serverTimestamp: () => "server-time",
        increment: (delta: number) => ({ increment: delta }),
      },
    };

    const result = await recordModelDownload(deps as never, {
      uid: "buyer",
      modelName: "google/gemma-2b-it",
      sourceUrl: "https://huggingface.co/google/gemma-2b-it",
    });

    expect(result).toEqual({ pointCost: 100, remainingPoints: 900 });
    expect(requestedDocPaths).toEqual(["users/buyer"]);
    expect(purchaseWrites[0]).toMatchObject({
      type: "model",
      modelName: "google/gemma-2b-it",
      ownerUid: "",
      pointCost: 100,
    });
  });
});
