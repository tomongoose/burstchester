import { describe, expect, it } from "vitest";

import { toHuggingFaceRepoUrl } from "@/lib/models/huggingface-url";

describe("toHuggingFaceRepoUrl", () => {
  it("keeps repository URLs unchanged", () => {
    expect(toHuggingFaceRepoUrl("https://huggingface.co/org/model")).toBe(
      "https://huggingface.co/org/model",
    );
  });

  it("converts resolve file URLs to repository URLs", () => {
    expect(
      toHuggingFaceRepoUrl("https://huggingface.co/org/model/resolve/main/model.safetensors"),
    ).toBe("https://huggingface.co/org/model");
  });

  it("leaves non-Hugging Face URLs unchanged", () => {
    expect(toHuggingFaceRepoUrl("https://example.com/org/model/resolve/main/file")).toBe(
      "https://example.com/org/model/resolve/main/file",
    );
  });
});
