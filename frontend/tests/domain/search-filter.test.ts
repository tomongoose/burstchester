import { describe, expect, it } from "vitest";
import { SearchFilter } from "@/lib/domain/search-filter";

describe("SearchFilter.create", () => {
  it("rejects unknown language", () => {
    expect(() => SearchFilter.create({ language: "xx" })).toThrow(/language/i);
  });

  it("rejects unknown task type", () => {
    expect(() => SearchFilter.create({ task: "garbage" })).toThrow(/task/i);
  });

  it("accepts partial filter (single field)", () => {
    const filter = SearchFilter.create({ language: "ko" });
    expect(filter.language).toBe("ko");
    expect(filter.task).toBeNull();
  });

  it("creates default empty filter when called with empty object", () => {
    const filter = SearchFilter.create({});
    expect(filter.language).toBeNull();
    expect(filter.task).toBeNull();
    expect(filter.baseModel).toBeNull();
    expect(filter.size).toBeNull();
    expect(filter.tags).toEqual([]);
  });
});
