import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock firebase/firestore primitives so we can capture which constraint
// builders are called and with which arguments. This treats the SDK as a
// **system boundary** (per ODP test-stub-for-query) and verifies the
// *behaviour* of buildDatasetQuery (the dispatch decisions) without
// coupling to internal Query implementation.
const callLog: Array<{ kind: string; args: unknown[] }> = [];

vi.mock("firebase/firestore", () => {
  const tag = (kind: string) => (...args: unknown[]) => {
    callLog.push({ kind, args });
    return { kind, args };
  };
  return {
    collection: tag("collection"),
    query: (...args: unknown[]) => {
      callLog.push({ kind: "query", args });
      return { kind: "query", args };
    },
    where: tag("where"),
    orderBy: tag("orderBy"),
    limit: tag("limit"),
  };
});

import { buildDatasetQuery } from "@/lib/datasets/build-query";
import { SearchFilter } from "@/lib/domain/search-filter";

const fakeDb = { __brand: "fake-firestore" } as unknown as import("firebase/firestore").Firestore;

function whereCalls(): Array<unknown[]> {
  return callLog.filter((c) => c.kind === "where").map((c) => c.args);
}
function orderByCalls(): Array<unknown[]> {
  return callLog.filter((c) => c.kind === "orderBy").map((c) => c.args);
}
function limitCalls(): Array<unknown[]> {
  return callLog.filter((c) => c.kind === "limit").map((c) => c.args);
}

beforeEach(() => {
  callLog.length = 0;
});

describe("buildDatasetQuery", () => {
  it("filters by status==active by default", () => {
    buildDatasetQuery(SearchFilter.create({}), { sort: "popular", db: fakeDb });

    expect(whereCalls()).toContainEqual(["status", "==", "active"]);
  });

  it("applies language equality when provided", () => {
    buildDatasetQuery(SearchFilter.create({ language: "ko" }), { sort: "popular", db: fakeDb });

    expect(whereCalls()).toContainEqual(["language", "==", "ko"]);
  });

  it("applies taskType equality when provided", () => {
    buildDatasetQuery(SearchFilter.create({ task: "instruction" }), { sort: "popular", db: fakeDb });

    expect(whereCalls()).toContainEqual(["taskType", "==", "instruction"]);
  });

  it("applies baseModelHint equality when provided", () => {
    buildDatasetQuery(SearchFilter.create({ baseModel: "qwen3:14b" }), { sort: "popular", db: fakeDb });

    expect(whereCalls()).toContainEqual(["baseModelHint", "==", "qwen3:14b"]);
  });

  it("applies tags array-contains-any when tags provided", () => {
    buildDatasetQuery(
      SearchFilter.create({ tags: ["legal", "korean"] }),
      { sort: "popular", db: fakeDb },
    );

    expect(whereCalls()).toContainEqual(["tags", "array-contains-any", ["legal", "korean"]]);
  });

  it("orders by downloadCount desc for popular sort", () => {
    buildDatasetQuery(SearchFilter.create({}), { sort: "popular", db: fakeDb });

    expect(orderByCalls()).toContainEqual(["downloadCount", "desc"]);
  });

  it("orders by createdAt desc for newest sort", () => {
    buildDatasetQuery(SearchFilter.create({}), { sort: "newest", db: fakeDb });

    expect(orderByCalls()).toContainEqual(["createdAt", "desc"]);
  });

  it("applies default limit of 24", () => {
    buildDatasetQuery(SearchFilter.create({}), { sort: "popular", db: fakeDb });

    expect(limitCalls()).toContainEqual([24]);
  });
});
