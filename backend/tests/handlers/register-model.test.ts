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
  });
});
