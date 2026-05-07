import { describe, expect, it } from "vitest";
import { HuggingFaceLocator } from "@/seed/hugging-face-locator";
import { validateSeedManifestEntry } from "@/seed/manifest";

const validRawEntry = {
  huggingFaceId: "burstchester/legal-ko-mini",
  revision: "main",
  filePath: "data/train.jsonl",
  title: "Korean Legal Q&A",
  description: "한국 법률 데이터셋",
  tags: ["legal", "korean"],
  language: "ko",
  taskType: "instruction",
  baseModelHint: "qwen3:14b",
  license: "CC-BY-4.0",
  sourceModel: "qwen3:14b",
};

describe("HuggingFaceLocator", () => {
  it("rejects an id without org/name slash", () => {
    expect(() => HuggingFaceLocator.create("notaslash", "main")).toThrow(/huggingFaceId/i);
  });

  it("rejects empty revision", () => {
    expect(() => HuggingFaceLocator.create("org/name", "")).toThrow(/revision/i);
  });

  it("builds the canonical resolve URL for a given file path", () => {
    const locator = HuggingFaceLocator.create("org/name", "main");

    const url = locator.resolveUrl("data/train.jsonl");

    expect(url).toBe("https://huggingface.co/datasets/org/name/resolve/main/data/train.jsonl");
  });

  it("freezes the returned locator", () => {
    const locator = HuggingFaceLocator.create("org/name", "main");

    expect(Object.isFrozen(locator)).toBe(true);
  });
});

describe("validateSeedManifestEntry", () => {
  it("rejects when title is missing or empty", () => {
    expect(() => validateSeedManifestEntry({ ...validRawEntry, title: "" })).toThrow(/title/i);
  });

  it("rejects unknown taskType", () => {
    expect(() => validateSeedManifestEntry({ ...validRawEntry, taskType: "garbage" })).toThrow(
      /taskType/i,
    );
  });

  it("rejects blacklisted source model", () => {
    expect(() =>
      validateSeedManifestEntry({ ...validRawEntry, sourceModel: "gpt-4o" }),
    ).toThrow(/source model/i);
  });

  it("freezes the returned entry record", () => {
    const entry = validateSeedManifestEntry(validRawEntry);

    expect(Object.isFrozen(entry)).toBe(true);
  });
});
