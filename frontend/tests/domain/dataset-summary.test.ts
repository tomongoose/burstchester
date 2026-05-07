import { describe, expect, it } from "vitest";
import { buildDatasetSummary } from "@/lib/domain/dataset-summary";

const baseRecord = {
  id: "ds-1",
  ownerName: "Alice",
  title: "Korean Legal Q&A",
  description: "한국 법률 데이터셋",
  tags: ["legal", "korean"],
  rowCount: 1000,
  likeCount: 12,
  downloadCount: 47,
  status: "active",
};

describe("buildDatasetSummary", () => {
  it("truncates description over 500 chars and appends ellipsis", () => {
    const summary = buildDatasetSummary({
      ...baseRecord,
      description: "x".repeat(600),
    });

    expect(summary.description.length).toBeLessThanOrEqual(501);
    expect(summary.description.endsWith("…")).toBe(true);
  });

  it("clamps negative counts to zero", () => {
    const summary = buildDatasetSummary({
      ...baseRecord,
      likeCount: -5,
      downloadCount: -10,
    });

    expect(summary.likeCount).toBe(0);
    expect(summary.downloadCount).toBe(0);
  });

  it("freezes the returned object", () => {
    const summary = buildDatasetSummary(baseRecord);

    expect(Object.isFrozen(summary)).toBe(true);
  });
});
