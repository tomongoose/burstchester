import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

import { handleRegisterModelHttp } from "@/handlers/register-model";

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

describe("registerModelHttp", () => {
  it("accepts bearer auth compatible with user access tokens", async () => {
    const response = createResponse();
    const written: Array<{ path: string; data: unknown }> = [];
    const deps = {
      auth: {
        verifyIdToken: async () => {
          throw new Error("should use injected bearer verifier");
        },
      },
      database: {
        ref: () => ({
          get: async () => ({
            exists: () => false,
            val: () => null,
          }),
        }),
      },
      db: {
        doc: (path: string) => ({
          set: async (data: unknown) => {
            written.push({ path, data });
          },
        }),
      },
      clock: { now: () => Timestamp.fromMillis(1_000) },
      generateId: () => "model-id",
      fieldValue: {
        serverTimestamp: () => "server-timestamp",
        increment: (delta: number) => delta,
      },
    };

    await handleRegisterModelHttp(
      deps as never,
      {
        headers: { authorization: "Bearer bst_user_token-secret" },
        body: {
          title: "Legal Ko LoRA",
          huggingFaceUrl: "https://huggingface.co/google/gemma-2-2b/resolve/main/model.safetensors",
          trainingMethod: "qlora",
        },
      },
      response as never,
      async (token) => {
        expect(token).toBe("bst_user_token-secret");
        return { uid: "anon-user" };
      },
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      model: {
        id: "model-model-id",
        ownerUid: "anon-user",
        huggingFaceUrl: "https://huggingface.co/google/gemma-2-2b/resolve/main/model.safetensors",
      },
    });
    expect(written[0]?.path).toBe("models/model-model-id");
    expect(written[0]?.data).toMatchObject({ title: "Legal Ko LoRA" });
  });

  it("charges unpaid training assets during registration", async () => {
    const response = createResponse();
    const paidStore = new Map<string, unknown>();
    const writes: Array<{ path: string; data: unknown }> = [];
    const transactionWrites: Array<{ path: string; data: unknown }> = [];
    const deps = {
      auth: {
        verifyIdToken: async () => {
          throw new Error("should use injected bearer verifier");
        },
      },
      database: {
        ref: (path: string) => ({
          get: async () => ({
            exists: () => {
              if (paidStore.has(path)) return true;
              if (path === "paidDownloads/anon-user") {
                return Array.from(paidStore.keys()).some((key) =>
                  key.startsWith("paidDownloads/anon-user/"),
                );
              }
              return false;
            },
            val: () => {
              if (paidStore.has(path)) return paidStore.get(path);
              if (path !== "paidDownloads/anon-user") return null;
              const datasets: Record<string, unknown> = {};
              const models: Record<string, unknown> = {};
              for (const [key, value] of paidStore) {
                const prefix = "paidDownloads/anon-user/";
                if (!key.startsWith(prefix)) continue;
                const [, type, id] = key.slice(prefix.length).match(/^(datasets|models)\/(.+)$/) ?? [];
                if (type === "datasets") datasets[id] = value;
                if (type === "models") models[id] = value;
              }
              return { datasets, models };
            },
          }),
          set: async (data: unknown) => {
            paidStore.set(path, data);
          },
        }),
      },
      db: {
        doc: (path: string) => ({
          get: async () => {
            if (path === "datasets/dataset-1") {
              return {
                exists: true,
                data: () => ({
                  ownerUid: "dataset-owner",
                  title: "Dataset One",
                  pointCost: 25,
                }),
              };
            }
            if (path === "models/google/gemma-2b-it") {
              return {
                exists: false,
                data: () => null,
              };
            }
            return {
              exists: false,
              data: () => null,
            };
          },
          set: async (data: unknown) => {
            writes.push({ path, data });
          },
        }),
        runTransaction: async (callback: (transaction: unknown) => Promise<void>) => {
          await callback({
            get: async () => ({ data: () => ({ points: 1_000 }) }),
            set: (ref: { path?: string }, data: unknown) => {
              transactionWrites.push({ path: ref.path ?? "", data });
            },
          });
        },
      },
      clock: { now: () => Timestamp.fromMillis(1_000) },
      generateId: () => "model-id",
      fieldValue: {
        serverTimestamp: () => "server-timestamp",
        increment: (delta: number) => delta,
      },
    };

    await handleRegisterModelHttp(
      deps as never,
      {
        headers: { authorization: "Bearer bst_user_token-secret" },
        body: {
          huggingFaceUrl: "https://huggingface.co/user/gemma-lora",
          baseModel: "google/gemma-2b-it",
          trainingDatasets: ["dataset-1"],
          trainingMethod: "lora",
        },
      },
      response as never,
      async () => ({ uid: "anon-user" }),
    );

    expect(response.statusCode).toBe(200);
    expect(writes[0]?.path).toBe("models/model-model-id");
    expect(
      Array.from(paidStore.values()).some((value) =>
        JSON.stringify(value).includes("\"datasetId\":\"dataset-1\""),
      ),
    ).toBe(true);
    expect(
      Array.from(paidStore.values()).some((value) =>
        JSON.stringify(value).includes("\"modelName\":\"google/gemma-2b-it\""),
      ),
    ).toBe(true);
    expect(transactionWrites.length).toBeGreaterThan(0);
  });
});
