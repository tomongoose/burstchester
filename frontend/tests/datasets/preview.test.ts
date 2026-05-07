import { describe, expect, it } from "vitest";
import { parsePreviewLines } from "@/lib/datasets/preview";

const OAI_LINE = (q: string, a: string) =>
  `{"messages":[{"role":"user","content":"${q}"},{"role":"assistant","content":"${a}"}]}`;

describe("parsePreviewLines", () => {
  it("returns first n samples from a multi-line jsonl", () => {
    const jsonl = [OAI_LINE("q1", "a1"), OAI_LINE("q2", "a2"), OAI_LINE("q3", "a3")].join("\n");

    const samples = parsePreviewLines(jsonl, 2);

    expect(samples).toHaveLength(2);
    expect(samples[0].messages[0]).toEqual({ role: "user", content: "q1" });
    expect(samples[1].messages[1]).toEqual({ role: "assistant", content: "a2" });
  });

  it("truncates each message content over 200 chars and appends ellipsis", () => {
    const longContent = "x".repeat(250);
    const jsonl = `{"messages":[{"role":"user","content":"${longContent}"},{"role":"assistant","content":"ok"}]}`;

    const [sample] = parsePreviewLines(jsonl, 1);

    expect(sample.messages[0].content.length).toBeLessThanOrEqual(201);
    expect(sample.messages[0].content.endsWith("…")).toBe(true);
  });

  it("skips malformed lines silently", () => {
    const jsonl = ["{not json}", OAI_LINE("q", "a"), "another bad line"].join("\n");

    const samples = parsePreviewLines(jsonl, 5);

    expect(samples).toHaveLength(1);
    expect(samples[0].messages[0].content).toBe("q");
  });

  it("returns empty array for empty string", () => {
    expect(parsePreviewLines("", 5)).toEqual([]);
  });
});
