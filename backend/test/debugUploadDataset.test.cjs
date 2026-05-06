const test = require("node:test");
const assert = require("node:assert/strict");

process.env.GCLOUD_PROJECT = "demo-burstchester";
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: "demo-burstchester",
  storageBucket: "demo-burstchester.appspot.com",
});

const { debugUploadDatasetHandler } = require("../lib/index.js");

function createResponse() {
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

test("debugUploadDatasetHandler rejects requests without bearer token", async () => {
  const response = createResponse();

  await debugUploadDatasetHandler(
    { headers: {}, body: {} },
    response,
    {
      verifyIdToken: async () => {
        throw new Error("should not verify");
      },
      uploadDataset: async () => {
        throw new Error("should not upload");
      },
    },
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, {
    ok: false,
    error: "Missing bearer token.",
  });
});

test("debugUploadDatasetHandler uploads provided JSONL content", async () => {
  const response = createResponse();

  await debugUploadDatasetHandler(
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
    response,
    {
      verifyIdToken: async (idToken) => {
        assert.equal(idToken, "firebase-id-token");
        return {
          uid: "u-debugger",
          email: "debugger@example.com",
          name: "Debugger",
        };
      },
      uploadDataset: async (input) => {
        assert.equal(input.ownerUid, "u-debugger");
        assert.equal(input.ownerName, "Debugger");
        assert.equal(input.filename, "legal-ko.jsonl");
        assert.match(input.content, /"messages"/);
        return {
          id: "debug-dataset-1",
          status: "active",
          normalizedStoragePath: "normalized/debug-dataset-1/dataset.jsonl",
        };
      },
    },
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    ok: true,
    dataset: {
      id: "debug-dataset-1",
      status: "active",
      normalizedStoragePath: "normalized/debug-dataset-1/dataset.jsonl",
    },
  });
});
