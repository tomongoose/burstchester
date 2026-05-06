import { describe, expect, it } from "vitest";
import {
  checkUploadPreconditions,
  type UploadPreconditionInput,
} from "@/core/datasets";
import { type DownloadableDataset } from "@/core/packaging";
import { getDownloadView } from "@/core/packaging";

const validInput: UploadPreconditionInput = {
  name: "datasets/u-alice/file.jsonl",
  size: 128,
  sourceConfirmed: true,
};

describe("checkUploadPreconditions — pure function", () => {
  it("returns null when all preconditions pass", () => {
    expect(checkUploadPreconditions(validInput)).toBeNull();
  });

  it("returns extension error for non-.jsonl file", () => {
    const result = checkUploadPreconditions({ ...validInput, name: "file.txt" });
    expect(result).toMatch(/jsonl/i);
  });

  it("returns size error when over 100MB", () => {
    const result = checkUploadPreconditions({ ...validInput, size: 100 * 1024 * 1024 + 1 });
    expect(result).toMatch(/100mb/i);
  });

  it("returns confirmation error when sourceConfirmed is false", () => {
    const result = checkUploadPreconditions({ ...validInput, sourceConfirmed: false });
    expect(result).toMatch(/source confirmation/i);
  });

  it("checks extension before size (deterministic order)", () => {
    const result = checkUploadPreconditions({
      ...validInput,
      name: "file.txt",
      size: 200 * 1024 * 1024,
      sourceConfirmed: false,
    });
    expect(result).toMatch(/jsonl/i);
  });
});

describe("getDownloadView — pure query (cache decision)", () => {
  function makeDataset(overrides: Partial<DownloadableDataset> = {}): DownloadableDataset {
    return {
      id: "ds-1",
      ownerUid: "u",
      ownerName: "U",
      title: "t",
      description: "",
      tags: [],
      baseModelHint: "",
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
      sourceModel: "qwen",
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

  it("returns cached view when zipPath is present and status is active/flagged", () => {
    const view = getDownloadView(makeDataset({ zipPath: "downloads/ds-1/ds-1.zip" }));
    expect(view.cached).toBe(true);
    expect(view.zipPath).toBe("downloads/ds-1/ds-1.zip");
  });

  it("returns needs-build view when zipPath is missing", () => {
    const view = getDownloadView(makeDataset({ zipPath: null }));
    expect(view.cached).toBe(false);
    expect(view.zipPath).toBe("downloads/ds-1/ds-1.zip");
  });

  it("throws when dataset status is rejected", () => {
    expect(() => getDownloadView(makeDataset({ status: "rejected" }))).toThrow(/not downloadable/i);
  });
});
