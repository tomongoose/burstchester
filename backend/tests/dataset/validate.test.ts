import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import {
  findPiiFindings,
  processDatasetUpload,
  validateDatasetUpload,
  type DatasetRecord,
  type DatasetUploadDeps,
  type StorageObjectInput,
} from "@/core/datasets";
import { evaluateSourceModel } from "@/core/source-models";

const TEST_NOW = Timestamp.fromDate(new Date("2026-05-05T00:00:00Z"));

class UploadDepsSpy implements DatasetUploadDeps {
  readonly upserted: DatasetRecord[] = [];
  readonly saved: Array<{ path: string; text: string; bucket: string }> = [];
  readonly userIncrements: string[] = [];
  textToReturn = '{"messages":[{"role":"user","content":"q"},{"role":"assistant","content":"a"}]}\n';

  downloadObjectText = async (_bucket: string, _path: string): Promise<string> => {
    return this.textToReturn;
  };
  saveNormalizedText = async (path: string, text: string, bucket: string): Promise<void> => {
    this.saved.push({ path, text, bucket });
  };
  upsertDataset = async (record: DatasetRecord): Promise<void> => {
    this.upserted.push(record);
  };
  incrementUserUploads = async (ownerUid: string): Promise<void> => {
    this.userIncrements.push(ownerUid);
  };
}

function validObject(overrides: Partial<StorageObjectInput> = {}): StorageObjectInput {
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
    ...overrides,
  };
}

describe("findPiiFindings — PII detection matrix", () => {
  it.each([
    ["email", "Contact me at alice@example.com please."],
    ["phone", "Call +82-10-1234-5678 anytime."],
    ["ssn", "Korean RRN 900101-1234567 here."],
    ["credit-card", "Card 4111111111111111 ends in 1111."],
    ["api-key", "Use sk-abcdef0123456789 for the API."],
  ])("detects %s pattern in matching content", (label, content) => {
    expect(findPiiFindings(content)).toContain(label);
  });

  it.each([
    ["email", "No contact info here."],
    ["phone", "Just text without numbers."],
    ["ssn", "Page 12-34 reference."],
    ["credit-card", "Short id 123 only."],
    ["api-key", "Plain unstructured prose."],
  ])("returns no findings for clean content (%s baseline)", (_label, content) => {
    expect(findPiiFindings(content)).toEqual([]);
  });
});

describe("processDatasetUpload — reject preconditions", () => {
  it("rejects upload when file extension is not .jsonl", async () => {
    const spy = new UploadDepsSpy();
    const obj = validObject({ name: "datasets/u-alice/file.txt" });

    const record = await processDatasetUpload(obj, spy, TEST_NOW);

    expect(record.status).toBe("rejected");
    expect(record.rejectReason).toMatch(/jsonl/i);
    expect(spy.saved).toEqual([]);
    expect(spy.userIncrements).toEqual([]);
    expect(spy.upserted).toHaveLength(1);
  });

  it("rejects upload when size exceeds 100MB", async () => {
    const spy = new UploadDepsSpy();
    const obj = validObject({ size: 100 * 1024 * 1024 + 1 });

    const record = await processDatasetUpload(obj, spy, TEST_NOW);

    expect(record.status).toBe("rejected");
    expect(record.rejectReason).toMatch(/100mb/i);
    expect(spy.saved).toEqual([]);
    expect(spy.userIncrements).toEqual([]);
  });

  it("rejects upload when sourceConfirmed metadata is missing or false", async () => {
    const spy = new UploadDepsSpy();
    const obj = validObject({
      metadata: {
        datasetId: "ds-1",
        ownerUid: "u-alice",
        sourceModel: "qwen3:14b",
      },
    });

    const record = await processDatasetUpload(obj, spy, TEST_NOW);

    expect(record.status).toBe("rejected");
    expect(record.rejectReason).toMatch(/source confirmation/i);
    expect(spy.saved).toEqual([]);
    expect(spy.userIncrements).toEqual([]);
  });
});

describe("validateDatasetUpload — format edge cases", () => {
  it("rejects ShareGPT with empty conversations array", () => {
    const result = validateDatasetUpload({
      content: '{"conversations":[]}\n',
      sourceModel: "qwen3:14b",
    });
    expect(result.status).toBe("rejected");
    expect(result.rejectReason).toMatch(/at least one message/i);
  });

  it("rejects ShareGPT with unsupported role", () => {
    const result = validateDatasetUpload({
      content: '{"conversations":[{"from":"observer","value":"x"}]}\n',
      sourceModel: "qwen3:14b",
    });
    expect(result.status).toBe("rejected");
    expect(result.rejectReason).toMatch(/unsupported role/i);
  });

  it("normalizes Alpaca with empty input to user message containing instruction only", () => {
    const result = validateDatasetUpload({
      content: '{"instruction":"Greet the user","output":"Hello!"}\n',
      sourceModel: "qwen3:14b",
    });
    expect(result.status).toBe("active");
    expect(result.detectedFormat).toBe("alpaca");
    const firstLine = JSON.parse(result.normalizedJsonl.trim());
    expect(firstLine.messages[1]).toEqual({
      role: "user",
      content: "Greet the user",
    });
  });

  it("rejects sample whose first message is assistant", () => {
    const result = validateDatasetUpload({
      content:
        '{"messages":[{"role":"assistant","content":"hi"},{"role":"user","content":"q"},{"role":"assistant","content":"a"}]}\n',
      sourceModel: "qwen3:14b",
    });
    expect(result.status).toBe("rejected");
    expect(result.rejectReason).toMatch(/first message/i);
  });
});

describe("evaluateSourceModel — conditional rules (Llama, Gemma)", () => {
  it.each([
    ["llama3.1:8b", "llama-community"],
    ["Llama-3-70B", "llama-community"],
    ["gemma2-9b", "gemma-tou"],
    ["GEMMA-3", "gemma-tou"],
  ])("classifies %s as conditional allow with %s license", (model, license) => {
    const result = evaluateSourceModel(model);

    expect(result.disposition).toBe("allow");
    expect(result.license).toBe(license);
  });
});

describe("buildMerkleRoot via validateDatasetUpload — hash chain edge cases", () => {
  it("produces a 64-char hex root for an odd leaf count (3 samples)", () => {
    const content =
      '{"messages":[{"role":"user","content":"q1"},{"role":"assistant","content":"a1"}]}\n' +
      '{"messages":[{"role":"user","content":"q2"},{"role":"assistant","content":"a2"}]}\n' +
      '{"messages":[{"role":"user","content":"q3"},{"role":"assistant","content":"a3"}]}\n';

    const result = validateDatasetUpload({ content, sourceModel: "qwen3:14b" });

    expect(result.status).toBe("active");
    expect(result.rowCount).toBe(3);
    expect(result.sampleHashesMerkleRoot).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns the same root for identical input (deterministic)", () => {
    const content =
      '{"messages":[{"role":"user","content":"q"},{"role":"assistant","content":"a"}]}\n';

    const a = validateDatasetUpload({ content, sourceModel: "qwen3:14b" });
    const b = validateDatasetUpload({ content, sourceModel: "qwen3:14b" });

    expect(a.sampleHashesMerkleRoot).toBe(b.sampleHashesMerkleRoot);
    expect(a.sampleHashesMerkleRoot).toMatch(/^[a-f0-9]{64}$/);
  });
});
