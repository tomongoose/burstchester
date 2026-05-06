import { describe, expect, it } from "vitest";
import { applyLikeWrite } from "@/core/engagement";
import {
  buildReadmeTemplate,
  prepareDownloadCore,
  type DownloadableDataset,
} from "@/core/packaging";

function makeDataset(overrides: Partial<DownloadableDataset> = {}): DownloadableDataset {
  return {
    id: "ds-1",
    ownerUid: "u",
    ownerName: "U",
    title: "Demo",
    description: "",
    tags: [],
    baseModelHint: "qwen3:14b",
    taskType: "instruction",
    format: "openai-messages",
    language: "en",
    license: "CC-BY",
    rowCount: 0,
    byteSize: 0,
    avgUserTokens: 0,
    avgAssistantTokens: 0,
    storagePath: "",
    normalizedStoragePath: null,
    zipPath: null,
    sourceModel: "qwen3:14b",
    sourceModelLicense: "apache-2.0",
    sourceConfirmed: true,
    parentDatasets: [],
    samplingMethod: null,
    capabilityTags: [],
    sampleHashesMerkleRoot: "",
    likeCount: 0,
    downloadCount: 0,
    reportCount: 0,
    searchKeywords: [],
    status: "active",
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe("applyLikeWrite — no-op branch", () => {
  it("returns delta 0 when beforeExists equals afterExists (idempotent)", () => {
    const result = applyLikeWrite({ ownerUid: "u", likeCount: 5 }, true, true);

    expect(result.dataset.likeCount).toBe(5);
    expect(result.owner.reputationDelta).toBe(0);
  });
});

describe("prepareDownloadCore — guard against rejected status", () => {
  it("throws when dataset status is rejected", async () => {
    const dataset = makeDataset({ status: "rejected" });
    const deps = {
      getDataset: async () => dataset,
      downloadNormalizedJsonl: async () => "",
      saveArchive: async () => {},
      getSignedUrl: async () => "",
      setZipPath: async () => {},
      incrementDownloadStats: async () => {},
    };

    await expect(
      prepareDownloadCore({ datasetId: "ds-1" }, deps, new Date()),
    ).rejects.toThrow(/not downloadable/i);
  });
});

describe("createDatasetArchive — Modelfile template inclusion", () => {
  it("zip archive contains Modelfile.template entry", async () => {
    const { createDatasetArchive } = await import("@/core/packaging");
    const archive = createDatasetArchive(
      {
        dataset: makeDataset(),
        normalizedJsonl:
          '{"messages":[{"role":"user","content":"q"},{"role":"assistant","content":"a"}]}\n',
      },
      new Date("2026-05-05T00:00:00Z"),
    );

    expect(archive.toString("utf8")).toMatch(/Modelfile\.template/);
  });
});

describe("buildReadmeTemplate — Colab URL option", () => {
  it("includes the provided Colab URL in the README body", () => {
    const dataset = makeDataset({ title: "Demo" });
    const readme = buildReadmeTemplate(dataset, {
      colabUrl: "https://colab.research.google.com/burstchester/unsloth-ollama",
    });

    expect(readme).toMatch(/colab\.research\.google\.com\/burstchester\/unsloth-ollama/);
  });

  it("omits the Colab section when no URL is provided (backward compatible)", () => {
    const dataset = makeDataset({ title: "Demo" });
    const readme = buildReadmeTemplate(dataset);

    expect(readme).not.toMatch(/colab\.research\.google\.com/);
  });
});
