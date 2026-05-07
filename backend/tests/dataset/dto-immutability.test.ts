import { describe, expect, it } from "vitest";
import {
  processDatasetUpload,
  type DatasetRecord,
  type DatasetUploadDeps,
  type StorageObjectInput,
} from "@/core/datasets";
import { buildUserProfile } from "@/core/profiles";
import { buildModelRecord } from "@/core/model-registry";
import { applyDownloadStats, applyLikeWrite, applyReportWrite } from "@/core/engagement";

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

describe("DatasetRecord — frozen returned object", () => {
  it("freezes the record returned from processDatasetUpload", async () => {
    const { Timestamp } = await import("firebase-admin/firestore");
    const record = await processDatasetUpload(
      validObject(),
      new UploadDepsSpy(),
      Timestamp.fromDate(new Date("2026-05-05T00:00:00Z")),
    );

    expect(Object.isFrozen(record)).toBe(true);
  });
});

describe("UserProfileRecord — frozen returned object", () => {
  it("freezes the record returned from buildUserProfile", async () => {
    const { Timestamp } = await import("firebase-admin/firestore");
    const profile = buildUserProfile(
      {
        uid: "u-alice",
        displayName: "Alice",
        email: "alice@example.com",
        photoURL: "https://example.com/a.png",
      },
      Timestamp.fromDate(new Date("2026-05-05T00:00:00Z")),
    );

    expect(Object.isFrozen(profile)).toBe(true);
  });
});

describe("ModelRecord — frozen returned object", () => {
  it("freezes the record returned from buildModelRecord", async () => {
    const { Timestamp } = await import("firebase-admin/firestore");
    const record = buildModelRecord(
      {
        ownerUid: "u-alice",
        huggingFaceUrl: "https://huggingface.co/user/model/resolve/main/file.gguf",
        baseModel: "qwen3:14b",
        trainingDatasets: ["ds-1"],
        trainingMethod: "lora",
      },
      () => "model-fixed",
      Timestamp.fromDate(new Date("2026-05-05T00:00:00Z")),
    );

    expect(Object.isFrozen(record)).toBe(true);
  });
});

describe("DownloadableDataset — readonly at type level", () => {
  it("rejects mutation at compile-time (verified by tsc -p tsconfig.tests.json)", () => {
    // Runtime no-op: the actual check is in the _typeLevelReadonlyChecks
    // function below. `npm run typecheck:tests` enforces it via @ts-expect-error.
    expect(true).toBe(true);
  });
});

// Compile-time only assertions (no runtime effect). If a `readonly` modifier
// is missing on the corresponding interface, the @ts-expect-error directive
// becomes "unused" and `tsc --noEmit` fails. This is the type-level red/green.
function _typeLevelReadonlyChecks() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const ds = {} as unknown as import("@/core/packaging").DownloadableDataset;
  // @ts-expect-error — readonly fields cannot be reassigned
  ds.tags = [];
  // @ts-expect-error
  ds.status = "active";

  const record = {} as unknown as DatasetRecord;
  // @ts-expect-error
  record.likeCount = 1;
  // @ts-expect-error
  record.tags = [];
}

describe("DatasetCounterState — frozen result objects (engagement)", () => {
  it("freezes applyLikeWrite result and its nested objects", () => {
    const result = applyLikeWrite({ ownerUid: "u-alice", likeCount: 0 }, false, true);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.dataset)).toBe(true);
    expect(Object.isFrozen(result.owner)).toBe(true);
  });

  it("freezes applyReportWrite result and its nested objects", () => {
    const result = applyReportWrite({ ownerUid: "u-alice", reportCount: 0 }, false, true);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.dataset)).toBe(true);
    expect(Object.isFrozen(result.owner)).toBe(true);
  });

  it("freezes applyDownloadStats result and its nested objects", () => {
    const result = applyDownloadStats({ ownerUid: "u-alice", downloadCount: 0 });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.dataset)).toBe(true);
    expect(Object.isFrozen(result.owner)).toBe(true);
  });
});
