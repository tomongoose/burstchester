const test = require("node:test");
const assert = require("node:assert/strict");
const { Timestamp } = require("firebase-admin/firestore");

const {
  buildModelRecord,
  validateHuggingFaceDownloadUrl,
} = require("../lib/core/model-registry.js");

const TEST_NOW = Timestamp.fromDate(new Date("2026-05-05T00:00:00Z"));

test("validateHuggingFaceDownloadUrl accepts downloadable hugging face URLs", () => {
  const result = validateHuggingFaceDownloadUrl(
    "https://huggingface.co/burstchester/legal-ko-qlora/resolve/main/model.gguf",
  );

  assert.equal(result.ok, true);
});

test("validateHuggingFaceDownloadUrl rejects non-huggingface domains", () => {
  const result = validateHuggingFaceDownloadUrl("https://example.com/model.gguf");

  assert.equal(result.ok, false);
  assert.match(result.reason, /hugging face/i);
});

test("buildModelRecord creates internal id and attaches owner id", () => {
  const record = buildModelRecord(
    {
      ownerUid: "user-1",
      huggingFaceUrl: "https://huggingface.co/burstchester/legal-ko-qlora/resolve/main/model.gguf",
      baseModel: "qwen3:14b",
      trainingDatasets: ["dataset-1"],
      trainingMethod: "qlora",
      ollamaPullUrl: "burstchester/legal-ko-qlora:latest",
    },
    () => "model-123",
    TEST_NOW,
  );

  assert.equal(record.id, "model-123");
  assert.equal(record.ownerUid, "user-1");
  assert.equal(record.huggingFaceUrl, "https://huggingface.co/burstchester/legal-ko-qlora/resolve/main/model.gguf");
  assert.equal(record.trainingMethod, "qlora");
  assert.deepEqual(record.trainingDatasets, ["dataset-1"]);
  assert.equal(record.evalReports.length, 0);
  assert.equal(typeof record.createdAt.toMillis, "function");
});
