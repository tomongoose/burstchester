const test = require("node:test");
const assert = require("node:assert/strict");

process.env.GCLOUD_PROJECT = "demo-burstchester";
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: "demo-burstchester",
  storageBucket: "demo-burstchester.appspot.com",
});

const { prepareDatasetDownloadHandler } = require("../lib/index.js");

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

test("prepareDatasetDownloadHandler returns 400 when datasetId is missing", async () => {
  const response = createResponse();
  let called = false;

  await prepareDatasetDownloadHandler(
    { query: {}, body: {} },
    response,
    async () => {
      called = true;
      return {};
    },
  );

  assert.equal(called, false);
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    ok: false,
    error: "datasetId is required.",
  });
});

test("prepareDatasetDownloadHandler returns dataset package metadata", async () => {
  const response = createResponse();

  await prepareDatasetDownloadHandler(
    { query: { datasetId: "dataset-1" }, body: {} },
    response,
    async (datasetId) => ({
      datasetId,
      cached: false,
      zipPath: "downloads/dataset-1/dataset-1.zip",
      url: "https://signed.example/downloads/dataset-1/dataset-1.zip",
    }),
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    ok: true,
    datasetId: "dataset-1",
    cached: false,
    zipPath: "downloads/dataset-1/dataset-1.zip",
    url: "https://signed.example/downloads/dataset-1/dataset-1.zip",
  });
});
