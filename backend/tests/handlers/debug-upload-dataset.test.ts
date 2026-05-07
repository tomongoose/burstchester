import { describe, it, expect } from "vitest";

import { createDebugUploadDatasetHandler } from "@/handlers/debug-upload-dataset";

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

describe("debugUploadDatasetHandler", () => {
  it("rejects requests without bearer token", async () => {
    const response = createResponse();

    const handler = createDebugUploadDatasetHandler({
      verifyIdToken: async () => {
        throw new Error("should not verify");
      },
      uploadDataset: async () => {
        throw new Error("should not upload");
      },
    });

    await handler({ headers: {}, body: {} }, response as never);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: "Missing bearer token.",
    });
  });

  it("uploads provided JSONL content", async () => {
    const response = createResponse();
    const verifiedTokens: string[] = [];
    const uploadedInputs: Array<{
      ownerUid: string;
      ownerName: string;
      filename: string;
      content: string;
    }> = [];

    const handler = createDebugUploadDatasetHandler({
      verifyIdToken: async (idToken) => {
        verifiedTokens.push(idToken);
        return {
          uid: "u-debugger",
          email: "debugger@example.com",
          name: "Debugger",
        };
      },
      uploadDataset: async (input) => {
        uploadedInputs.push({
          ownerUid: input.ownerUid,
          ownerName: input.ownerName,
          filename: input.filename,
          content: input.content,
        });
        return {
          id: "debug-dataset-1",
          status: "active",
          normalizedStoragePath: "normalized/debug-dataset-1/dataset.jsonl",
        };
      },
    });

    await handler(
      {
        headers: { authorization: "Bearer firebase-id-token" },
        body: {
          filename: "legal-ko.jsonl",
          content:
            '{"messages":[{"role":"user","content":"질문"},{"role":"assistant","content":"답변"}]}\n',
          title: "Legal Debug Dataset",
          sourceModel: "human",
        },
      },
      response as never,
    );

    expect(verifiedTokens).toEqual(["firebase-id-token"]);
    expect(uploadedInputs.length).toBe(1);
    expect(uploadedInputs[0].ownerUid).toBe("u-debugger");
    expect(uploadedInputs[0].ownerName).toBe("Debugger");
    expect(uploadedInputs[0].filename).toBe("legal-ko.jsonl");
    expect(uploadedInputs[0].content).toMatch(/"messages"/);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      dataset: {
        id: "debug-dataset-1",
        status: "active",
        normalizedStoragePath: "normalized/debug-dataset-1/dataset.jsonl",
      },
    });
  });
});
