import { describe, expect, it } from "vitest";
import { DatasetSize } from "@/lib/domain/dataset-size";

describe("DatasetSize.fromRowCount", () => {
  it.each([
    [0, "tiny"],
    [50, "tiny"],
    [99, "tiny"],
    [100, "small"],
    [500, "small"],
    [999, "small"],
    [1000, "medium"],
    [5000, "medium"],
    [9999, "medium"],
    [10_000, "large"],
    [50_000, "large"],
  ] as const)("classifies rowCount=%i as %s", (rowCount, expected) => {
    expect(DatasetSize.fromRowCount(rowCount).category).toBe(expected);
  });

  it("rejects negative row count", () => {
    expect(() => DatasetSize.fromRowCount(-1)).toThrow(/non-negative/i);
  });
});
