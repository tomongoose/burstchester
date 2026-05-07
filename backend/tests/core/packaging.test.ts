import { describe, it, expect } from "vitest";

import {
  buildModelfileTemplate,
  buildReadmeTemplate,
  createDatasetArchive,
  prepareDownloadCore,
} from "@/core/packaging";

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
} as const;

describe("buildModelfileTemplate", () => {
  it("includes dataset title and qwen stop tokens", () => {
    const template = buildModelfileTemplate(dataset);

    expect(template).toMatch(/Korean Legal Q&A/);
    expect(template).toMatch(/<\|im_end\|>/);
  });
});

describe("buildReadmeTemplate", () => {
  it("mentions Ollama workflow and dataset metadata", () => {
    const readme = buildReadmeTemplate(dataset);

    expect(readme).toMatch(/Ollama/i);
    expect(readme).toMatch(/Korean Legal Q&A/);
    expect(readme).toMatch(/qwen3:14b/);
  });
});

describe("createDatasetArchive", () => {
  it("packs all required files into a zip buffer", () => {
    const archive = createDatasetArchive(
      {
        dataset,
        normalizedJsonl:
          '{"messages":[{"role":"user","content":"질문"},{"role":"assistant","content":"답변"}]}\n',
      },
      new Date("2026-05-05T00:00:00.000Z"),
    );

    const text = archive.toString("utf8");
    expect(archive.length).toBeGreaterThan(100);
    expect(text).toMatch(/dataset\.jsonl/);
    expect(text).toMatch(/meta\.json/);
    expect(text).toMatch(/Modelfile\.template/);
    expect(text).toMatch(/README\.md/);
    expect(text).toMatch(/LICENSE/);
  });
});

describe("prepareDownloadCore", () => {
  it("reuses cache miss output and returns signed url", async () => {
    const writes: Array<{ path: string; bytes: Buffer }> = [];
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
      new Date("2026-05-05T00:00:00.000Z"),
    );

    expect(result.cached).toBe(false);
    expect(result.zipPath).toBe("downloads/dataset-1/dataset-1.zip");
    expect(result.url).toBe("https://signed.example/downloads/dataset-1/dataset-1.zip");
    expect(writes[0].path).toBe("downloads/dataset-1/dataset-1.zip");
  });
});
