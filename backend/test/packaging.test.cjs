const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildModelfileTemplate,
  buildReadmeTemplate,
  createDatasetArchive,
  prepareDownloadCore,
} = require("../lib/core/packaging.js");

const dataset = {
  id: "dataset-1",
  ownerUid: "user-1",
  ownerName: "Burst Tester",
  title: "Korean Legal Q&A",
  description: "한국어 법률 질답",
  tags: ["legal", "korean"],
  baseModelHint: "qwen3:14b",
  taskType: "instruction",
  format: "openai-messages",
  language: "ko",
  license: "CC-BY",
  rowCount: 1,
  byteSize: 123,
  avgUserTokens: 6,
  avgAssistantTokens: 12,
  storagePath: "gs://bucket/datasets/user-1/legal-ko.jsonl",
  normalizedStoragePath: "normalized/dataset-1/dataset.jsonl",
  zipPath: null,
  sourceModel: "qwen3:14b",
  sourceModelLicense: "apache-2.0",
  sourceConfirmed: true,
  parentDatasets: [],
  samplingMethod: "llm-output",
  capabilityTags: [],
  sampleHashesMerkleRoot: "a".repeat(64),
  likeCount: 0,
  downloadCount: 0,
  reportCount: 0,
  searchKeywords: ["korean", "legal"],
  status: "active",
  createdAt: new Date("2026-05-05T00:00:00.000Z"),
  updatedAt: new Date("2026-05-05T00:00:00.000Z"),
};

test("buildModelfileTemplate includes dataset title and qwen stop tokens", () => {
  const template = buildModelfileTemplate(dataset);

  assert.match(template, /Korean Legal Q&A/);
  assert.match(template, /<\|im_end\|>/);
});

test("buildReadmeTemplate mentions Ollama workflow and dataset metadata", () => {
  const readme = buildReadmeTemplate(dataset);

  assert.match(readme, /Ollama/i);
  assert.match(readme, /Korean Legal Q&A/);
  assert.match(readme, /qwen3:14b/);
});

test("createDatasetArchive packs all required files into a zip buffer", () => {
  const archive = createDatasetArchive({
    dataset,
    normalizedJsonl:
      '{"messages":[{"role":"user","content":"질문"},{"role":"assistant","content":"답변"}]}\n',
  });

  const text = archive.toString("utf8");
  assert.ok(archive.length > 100);
  assert.match(text, /dataset\.jsonl/);
  assert.match(text, /meta\.json/);
  assert.match(text, /Modelfile\.template/);
  assert.match(text, /README\.md/);
  assert.match(text, /LICENSE/);
});

test("prepareDownloadCore reuses cache miss output and returns signed url", async () => {
  const writes = [];
  const result = await prepareDownloadCore(
    {
      datasetId: "dataset-1",
      requesterUid: "user-9",
    },
    {
      getDataset: async () => ({ ...dataset }),
      downloadNormalizedJsonl: async () =>
        '{"messages":[{"role":"user","content":"질문"},{"role":"assistant","content":"답변"}]}\n',
      saveArchive: async (path, bytes) => {
        writes.push({ path, bytes });
      },
      getSignedUrl: async (path) => `https://signed.example/${path}`,
      setZipPath: async () => {},
      incrementDownloadStats: async () => {},
    },
  );

  assert.equal(result.cached, false);
  assert.equal(result.zipPath, "downloads/dataset-1/dataset-1.zip");
  assert.equal(result.url, "https://signed.example/downloads/dataset-1/dataset-1.zip");
  assert.equal(writes[0].path, "downloads/dataset-1/dataset-1.zip");
});
