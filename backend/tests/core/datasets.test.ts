import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

import {
  processDatasetUpload,
  validateDatasetUpload,
} from "@/core/datasets";

const TEST_NOW = Timestamp.fromDate(new Date("2026-05-05T00:00:00Z"));

describe("validateDatasetUpload", () => {
  it("normalizes ShareGPT into OpenAI messages", () => {
    const result = validateDatasetUpload({
      content:
        '{"conversations":[{"from":"human","value":"안녕"},{"from":"gpt","value":"반가워"}]}\n',
      sourceModel: "qwen3:14b",
    });

    expect(result.status).toBe("active");
    expect(result.detectedFormat).toBe("sharegpt");
    expect(result.rowCount).toBe(1);
    expect(result.sampleHashesMerkleRoot.length).toBe(64);

    const firstLine = JSON.parse(result.normalizedJsonl.trim());
    expect(firstLine.messages).toEqual([
      { role: "user", content: "안녕" },
      { role: "assistant", content: "반가워" },
    ]);
  });

  it("sends PII findings to pending review", () => {
    const result = validateDatasetUpload({
      content:
        '{"messages":[{"role":"user","content":"문의 메일은 admin@example.com"},{"role":"assistant","content":"확인했습니다."}]}\n',
      sourceModel: "qwen3:14b",
    });

    expect(result.status).toBe("pending_review");
    expect(result.piiFindings.length).toBeGreaterThan(0);
  });

  it("rejects blacklisted source model outputs", () => {
    const result = validateDatasetUpload({
      content:
        '{"messages":[{"role":"user","content":"질문"},{"role":"assistant","content":"답변"}]}\n',
      sourceModel: "gpt-4o",
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectReason).toMatch(/source model/i);
  });

  it("rejects samples whose last message is not assistant", () => {
    const result = validateDatasetUpload({
      content:
        '{"messages":[{"role":"user","content":"질문"},{"role":"user","content":"추가 질문"}]}\n',
      sourceModel: "qwen3:14b",
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectReason).toMatch(/last message/i);
  });
});

describe("processDatasetUpload", () => {
  it("builds dataset metadata and normalized storage path", async () => {
    const writes: unknown[] = [];
    const saved: Array<{ path: string; text: string }> = [];

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

    expect(dataset.id).toBe("dataset-1");
    expect(dataset.status).toBe("active");
    expect(dataset.format).toBe("openai-messages");
    expect(dataset.rowCount).toBe(1);
    expect(dataset.storagePath).toBe(
      "gs://burstchester-e08c3.appspot.com/datasets/user-1/legal-ko.jsonl",
    );
    expect(dataset.normalizedStoragePath).toBe("normalized/dataset-1/dataset.jsonl");
    expect(dataset.outputModelId).toBe("model-123");
    expect(dataset.searchKeywords).toContain("legal");
    expect(saved[0].path).toBe("normalized/dataset-1/dataset.jsonl");
    expect(writes.length).toBe(1);
  });

  it("keeps outputModelId nullable when omitted", async () => {
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

    expect(dataset.outputModelId).toBeNull();
  });
});
