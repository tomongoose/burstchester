import { describe, it, expect } from "vitest";

import { evaluateSourceModel } from "@/core/source-models";

describe("evaluateSourceModel", () => {
  it("allows Apache family models", () => {
    const result = evaluateSourceModel("qwen3:14b");

    expect(result.disposition).toBe("allow");
    expect(result.license).toBe("apache-2.0");
  });

  it("rejects closed provider outputs", () => {
    const result = evaluateSourceModel("gpt-4o");

    expect(result.disposition).toBe("reject");
    expect(result.reason).toMatch(/openai/i);
  });

  it("keeps unknown models pending review", () => {
    const result = evaluateSourceModel("my-custom-lab-model");

    expect(result.disposition).toBe("pending_review");
    expect(result.license).toBe("other");
  });
});
