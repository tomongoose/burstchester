const test = require("node:test");
const assert = require("node:assert/strict");
const { Timestamp } = require("firebase-admin/firestore");

const {
  processDatasetUpload,
  validateDatasetUpload,
} = require("../lib/core/datasets.js");

const TEST_NOW = Timestamp.fromDate(new Date("2026-05-05T00:00:00Z"));

test("validateDatasetUpload normalizes ShareGPT into OpenAI messages", () => {
  const result = validateDatasetUpload({
    content:
      '{"conversations":[{"from":"human","value":"안녕"},{"from":"gpt","value":"반가워"}]}\n',
    sourceModel: "qwen3:14b",
  });

  assert.equal(result.status, "active");
  assert.equal(result.detectedFormat, "sharegpt");
  assert.equal(result.rowCount, 1);
  assert.equal(result.sampleHashesMerkleRoot.length, 64);

  const firstLine = JSON.parse(result.normalizedJsonl.trim());
  assert.deepEqual(firstLine.messages, [
    { role: "user", content: "안녕" },
    { role: "assistant", content: "반가워" },
  ]);
});

test("validateDatasetUpload sends PII findings to pending review", () => {
  const result = validateDatasetUpload({
    content:
      '{"messages":[{"role":"user","content":"문의 메일은 admin@example.com"},{"role":"assistant","content":"확인했습니다."}]}\n',
    sourceModel: "qwen3:14b",
  });

  assert.equal(result.status, "pending_review");
  assert.ok(result.piiFindings.length > 0);
});

test("validateDatasetUpload rejects blacklisted source model outputs", () => {
  const result = validateDatasetUpload({
    content:
      '{"messages":[{"role":"user","content":"질문"},{"role":"assistant","content":"답변"}]}\n',
    sourceModel: "gpt-4o",
  });

  assert.equal(result.status, "rejected");
  assert.match(result.rejectReason, /source model/i);
});

test("validateDatasetUpload rejects samples whose last message is not assistant", () => {
  const result = validateDatasetUpload({
    content:
      '{"messages":[{"role":"user","content":"질문"},{"role":"user","content":"추가 질문"}]}\n',
    sourceModel: "qwen3:14b",
  });

  assert.equal(result.status, "rejected");
  assert.match(result.rejectReason, /last message/i);
});

test("processDatasetUpload builds dataset metadata and normalized storage path", async () => {
  const writes = [];
  const saved = [];

  const dataset = await processDatasetUpload(
    {
      name: "datasets/user-1/legal-ko.jsonl",
      bucket: "burstchester-e08c3.appspot.com",
      contentType: "application/jsonl",
      size: 128,
      metadata: {
        datasetId: "dataset-1",
        ownerUid: "user-1",
        ownerName: "Burst Tester",
        title: "Korean Legal Q&A",
        description: "한국어 법률 데이터셋",
        tags: "legal, korean",
        baseModelHint: "qwen3:14b",
        taskType: "instruction",
        language: "ko",
        license: "CC-BY",
        sourceModel: "qwen3:14b",
        sourceConfirmed: "true",
        outputModelId: "model-123",
      },
    },
    {
      downloadObjectText: async () =>
        '{"messages":[{"role":"user","content":"헌법 1조는?"},{"role":"assistant","content":"대한민국은 민주공화국이다."}]}\n',
      saveNormalizedText: async (path, text) => {
        saved.push({ path, text });
      },
      upsertDataset: async (record) => {
        writes.push(record);
      },
      incrementUserUploads: async () => {},
    },
    TEST_NOW,
  );

  assert.equal(dataset.id, "dataset-1");
  assert.equal(dataset.status, "active");
  assert.equal(dataset.format, "openai-messages");
  assert.equal(dataset.rowCount, 1);
  assert.equal(dataset.storagePath, "gs://burstchester-e08c3.appspot.com/datasets/user-1/legal-ko.jsonl");
  assert.equal(dataset.normalizedStoragePath, "normalized/dataset-1/dataset.jsonl");
  assert.equal(dataset.outputModelId, "model-123");
  assert.ok(dataset.searchKeywords.includes("legal"));
  assert.equal(saved[0].path, "normalized/dataset-1/dataset.jsonl");
  assert.equal(writes.length, 1);
});

test("processDatasetUpload keeps outputModelId nullable when omitted", async () => {
  const dataset = await processDatasetUpload(
    {
      name: "datasets/user-1/general-ko.jsonl",
      bucket: "burstchester-e08c3.appspot.com",
      contentType: "application/jsonl",
      size: 128,
      metadata: {
        datasetId: "dataset-2",
        ownerUid: "user-1",
        ownerName: "Burst Tester",
        title: "General Korean Q&A",
        description: "일반 한국어 질답",
        tags: "general, korean",
        baseModelHint: "qwen3:14b",
        taskType: "instruction",
        language: "ko",
        license: "CC-BY",
        sourceModel: "qwen3:14b",
        sourceConfirmed: "true",
      },
    },
    {
      downloadObjectText: async () =>
        '{"messages":[{"role":"user","content":"질문"},{"role":"assistant","content":"답변"}]}\n',
      saveNormalizedText: async () => {},
      upsertDataset: async () => {},
      incrementUserUploads: async () => {},
    },
    TEST_NOW,
  );

  assert.equal(dataset.outputModelId, null);
});
