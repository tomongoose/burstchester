import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

import {
  buildModelRecord,
  validateHuggingFaceDownloadUrl,
} from "@/core/model-registry";

const TEST_NOW = Timestamp.fromDate(new Date("2026-05-05T00:00:00Z"));

describe("validateHuggingFaceDownloadUrl", () => {
  it("accepts downloadable hugging face URLs", () => {
    const result = validateHuggingFaceDownloadUrl(
      "https://huggingface.co/burstchester/legal-ko-qlora/resolve/main/model.gguf",
    );

    expect(result.ok).toBe(true);
  });

  it("rejects non-huggingface domains", () => {
    const result = validateHuggingFaceDownloadUrl("https://example.com/model.gguf");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.reason).toMatch(/hugging face/i);
  });
});

describe("buildModelRecord", () => {
  it("creates internal id and attaches owner id", () => {
    const record = buildModelRecord(
      {
        ownerUid: "user-1",
        huggingFaceUrl:
          "https://huggingface.co/burstchester/legal-ko-qlora/resolve/main/model.gguf",
        baseModel: "qwen3:14b",
        trainingDatasets: ["dataset-1"],
        trainingMethod: "qlora",
        ollamaPullUrl: "burstchester/legal-ko-qlora:latest",
      },
      () => "model-123",
      TEST_NOW,
    );

    expect(record.id).toBe("model-123");
    expect(record.ownerUid).toBe("user-1");
    expect(record.huggingFaceUrl).toBe(
      "https://huggingface.co/burstchester/legal-ko-qlora/resolve/main/model.gguf",
    );
    expect(record.trainingMethod).toBe("qlora");
    expect(record.trainingDatasets).toEqual(["dataset-1"]);
    expect(record.evalReports.length).toBe(0);
    expect(typeof record.createdAt.toMillis).toBe("function");
  });
});
