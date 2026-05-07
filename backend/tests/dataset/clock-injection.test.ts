import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import {
  processDatasetUpload,
  type DatasetRecord,
  type DatasetUploadDeps,
  type StorageObjectInput,
} from "@/core/datasets";

class UploadDepsSpy implements DatasetUploadDeps {
  readonly upserted: DatasetRecord[] = [];
  textToReturn = '{"messages":[{"role":"user","content":"q"},{"role":"assistant","content":"a"}]}\n';

  downloadObjectText = async (): Promise<string> => this.textToReturn;
  saveNormalizedText = async (): Promise<void> => {};
  upsertDataset = async (record: DatasetRecord): Promise<void> => {
    this.upserted.push(record);
  };
  incrementUserUploads = async (): Promise<void> => {};
}

const FIXED_NOW = Timestamp.fromDate(new Date("2099-01-01T00:00:00Z"));

function validObject(): StorageObjectInput {
  return {
    name: "datasets/u-alice/file.jsonl",
    bucket: "test-bucket",
    contentType: "application/jsonl",
    size: 128,
    metadata: {
      datasetId: "ds-1",
      ownerUid: "u-alice",
      sourceConfirmed: "true",
      sourceModel: "qwen3:14b",
    },
  };
}

describe("processDatasetUpload — clock injection", () => {
  it("uses the provided now for createdAt and updatedAt", async () => {
    const record = await processDatasetUpload(validObject(), new UploadDepsSpy(), FIXED_NOW);

    expect(record.createdAt).toBe(FIXED_NOW);
    expect(record.updatedAt).toBe(FIXED_NOW);
  });
});

describe("buildUserProfile — clock injection", () => {
  it("uses the provided now for createdAt", async () => {
    const { buildUserProfile } = await import("@/core/profiles");

    const profile = buildUserProfile(
      { uid: "u-alice", displayName: "Alice", email: "alice@example.com" },
      FIXED_NOW,
    );

    expect(profile.createdAt).toBe(FIXED_NOW);
  });
});

describe("buildModelRecord — clock injection", () => {
  it("uses the provided now for createdAt and updatedAt", async () => {
    const { buildModelRecord } = await import("@/core/model-registry");

    const record = buildModelRecord(
      {
        ownerUid: "u-alice",
        huggingFaceUrl: "https://huggingface.co/user/model/resolve/main/file.gguf",
      },
      () => "model-fixed-id",
      FIXED_NOW,
    );

    expect(record.id).toBe("model-fixed-id");
    expect(record.createdAt).toBe(FIXED_NOW);
    expect(record.updatedAt).toBe(FIXED_NOW);
  });
});

describe("prepareDownloadCore — clock injection forwards into archive", () => {
  it("forwards the injected now to createDatasetArchive (deterministic when same now)", async () => {
    const { prepareDownloadCore } = await import("@/core/packaging");
    const dataset = {
      id: "ds-1",
      ownerUid: "u-alice",
      ownerName: "Alice",
      title: "Test",
      description: "",
      tags: [],
      baseModelHint: "qwen3:14b",
      taskType: "instruction",
      format: "openai-messages",
      language: "en",
      license: "CC-BY",
      rowCount: 1,
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
    } as const;
    const archives: Buffer[] = [];
    const deps = {
      getDataset: async () => dataset,
      downloadNormalizedJsonl: async () =>
        '{"messages":[{"role":"user","content":"q"},{"role":"assistant","content":"a"}]}\n',
      saveArchive: async (_path: string, bytes: Buffer) => {
        archives.push(bytes);
      },
      getSignedUrl: async (path: string) => `https://signed/${path}`,
      setZipPath: async () => {},
      incrementDownloadStats: async () => {},
    };
    const fixedNow = new Date("2026-05-05T00:00:00Z");

    await prepareDownloadCore({ datasetId: "ds-1" }, deps, fixedNow);
    await prepareDownloadCore({ datasetId: "ds-1" }, deps, fixedNow);

    expect(archives.length).toBe(2);
    expect(Buffer.compare(archives[0], archives[1])).toBe(0);
  });
});

describe("createDatasetArchive — clock injection (deterministic ZIP)", () => {
  it("produces byte-identical archives when invoked twice with the same now", async () => {
    const { createDatasetArchive } = await import("@/core/packaging");
    const now = new Date("2026-05-05T00:00:00Z");
    const baseDataset = {
      id: "ds-1",
      ownerUid: "u-alice",
      ownerName: "Alice",
      title: "Test",
      description: "",
      tags: [],
      baseModelHint: "qwen3:14b",
      taskType: "instruction",
      format: "openai-messages",
      language: "en",
      license: "CC-BY",
      rowCount: 1,
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
    } as const;
    const normalizedJsonl =
      '{"messages":[{"role":"user","content":"q"},{"role":"assistant","content":"a"}]}\n';

    const a = createDatasetArchive({ dataset: baseDataset, normalizedJsonl }, now);
    const b = createDatasetArchive({ dataset: baseDataset, normalizedJsonl }, now);

    expect(Buffer.compare(a, b)).toBe(0);
  });
});
