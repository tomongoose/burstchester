import { describe, expect, it } from "vitest";

import {
  applyListDatasetsQuery,
  buildListDatasetsServerQueryPlan,
  buildListDatasetsRateLimitKey,
  createListDatasetsHandler,
  enforceListDatasetsRateLimit,
} from "@/handlers/list-datasets";

interface ResponseStub {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  setHeader(name: string, value: string): ResponseStub;
  status(code: number): ResponseStub;
  json(payload: unknown): ResponseStub;
  send(payload?: unknown): ResponseStub;
}

function createResponse(): ResponseStub {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
}

const STUB_DEPS = {} as Parameters<typeof createListDatasetsHandler>[0];

describe("listDatasetsHandler", () => {
  it("rejects requests without bearer token", async () => {
    const response = createResponse();
    const handler = createListDatasetsHandler(STUB_DEPS);

    await handler(
      {
        method: "GET",
        headers: {},
        query: {},
      },
      response as never,
      async () => [] as never,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: "Missing bearer token.",
    });
  });

  it("returns active dataset summaries from the list executor", async () => {
    const response = createResponse();
    let receivedQuery: unknown;
    const handler = createListDatasetsHandler(STUB_DEPS);

    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer firebase-id-token" },
        query: {
          language: "ko",
          sort: "newest",
          tags: "domain/legal,quality:seed",
        },
      },
      response as never,
      async (query) => {
        receivedQuery = query;
        return [
          {
            id: "dataset-1",
            ownerUid: "uid-alice",
            ownerName: "Alice",
            title: "Legal Ko",
            description: "Korean legal dataset",
            tags: ["domain/legal", "quality:seed"],
            rowCount: 1200,
            likeCount: 3,
            downloadCount: 9,
            status: "active",
          },
        ] as never;
      },
      async (idToken) => {
        expect(idToken).toBe("firebase-id-token");
        return { uid: "u-alice" } as never;
      },
      async (uid, rateLimitKey) => {
        expect(uid).toBe("u-alice");
        expect(rateLimitKey).toBe(
          buildListDatasetsRateLimitKey("u-alice", {
            ownerUid: null,
            language: "ko",
            task: null,
            baseModel: null,
            tags: ["domain/legal", "quality:seed"],
            sort: "newest",
            limit: 24,
          }),
        );
        return { allowed: true } as never;
      },
    );

    expect(receivedQuery).toEqual({
      ownerUid: null,
      language: "ko",
      task: null,
      baseModel: null,
      tags: ["domain/legal", "quality:seed"],
      sort: "newest",
      limit: 24,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(response.headers["Access-Control-Allow-Headers"]).toBe(
      "Content-Type, Authorization",
    );
    expect(response.body).toEqual({
      ok: true,
      datasets: [
        {
          id: "dataset-1",
          ownerUid: "uid-alice",
          ownerName: "Alice",
          title: "Legal Ko",
          description: "Korean legal dataset",
          tags: ["domain/legal", "quality:seed"],
          rowCount: 1200,
          likeCount: 3,
          downloadCount: 9,
          status: "active",
        },
      ],
    });
  });

  it("responds to OPTIONS preflight without calling the list executor", async () => {
    const response = createResponse();
    let called = false;
    const handler = createListDatasetsHandler(STUB_DEPS);

    await handler(
      {
        method: "OPTIONS",
        headers: {},
        query: {},
      },
      response as never,
      async () => {
        called = true;
        return [] as never;
      },
    );

    expect(called).toBe(false);
    expect(response.statusCode).toBe(204);
  });

  it("rejects repeated requests within 5 seconds for the same uid", async () => {
    const response = createResponse();
    const handler = createListDatasetsHandler(STUB_DEPS);

    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer firebase-id-token" },
        query: {},
      },
      response as never,
      async () => [] as never,
      async () => ({ uid: "u-repeat" }) as never,
      async (_uid, rateLimitKey) => {
        expect(rateLimitKey).toBe(
          buildListDatasetsRateLimitKey("u-repeat", {
            ownerUid: null,
            language: null,
            task: null,
            baseModel: null,
            tags: [],
            sort: "popular",
            limit: 24,
          }),
        );
        return { allowed: false, retryAfterMs: 5000 } as never;
      },
    );

    expect(response.statusCode).toBe(429);
    expect(response.body).toEqual({
      ok: false,
      error: "Rate limit exceeded. Try again in a few seconds.",
      retryAfterMs: 5000,
    });
  });

  it("builds a different rate-limit key when the query changes", async () => {
    const response = createResponse();
    const seenKeys: string[] = [];
    const handler = createListDatasetsHandler(STUB_DEPS);

    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer firebase-id-token" },
        query: { sort: "popular" },
      },
      response as never,
      async () => [] as never,
      async () => ({ uid: "u-repeat" }) as never,
      async (_uid, rateLimitKey) => {
        seenKeys.push(rateLimitKey);
        return { allowed: true } as never;
      },
    );

    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer firebase-id-token" },
        query: { sort: "newest", language: "ko" },
      },
      response as never,
      async () => [] as never,
      async () => ({ uid: "u-repeat" }) as never,
      async (_uid, rateLimitKey) => {
        seenKeys.push(rateLimitKey);
        return { allowed: true } as never;
      },
    );

    expect(seenKeys).toEqual([
      buildListDatasetsRateLimitKey("u-repeat", {
        ownerUid: null,
        language: null,
        task: null,
        baseModel: null,
        tags: [],
        sort: "popular",
        limit: 24,
      }),
      buildListDatasetsRateLimitKey("u-repeat", {
        ownerUid: null,
        language: "ko",
        task: null,
        baseModel: null,
        tags: [],
        sort: "newest",
        limit: 24,
      }),
    ]);
  });

  it("reads ownerUid for profile-scoped dataset listings", async () => {
    const response = createResponse();
    let receivedQuery: unknown;
    const handler = createListDatasetsHandler(STUB_DEPS);

    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer firebase-id-token" },
        query: { ownerUid: "profile-owner", sort: "newest" },
      },
      response as never,
      async (query) => {
        receivedQuery = query;
        return [] as never;
      },
      async () => ({ uid: "viewer" }) as never,
      async (_uid, rateLimitKey) => {
        expect(rateLimitKey).toContain("profile-owner");
        return { allowed: true } as never;
      },
    );

    expect(receivedQuery).toEqual({
      ownerUid: "profile-owner",
      language: null,
      task: null,
      baseModel: null,
      tags: [],
      sort: "newest",
      limit: 24,
    });
  });

  it("filters and sorts dataset records in memory", () => {
    const result = applyListDatasetsQuery(
      [
        {
          id: "dataset-1",
          ownerUid: "uid-alice",
          ownerName: "Alice",
          title: "Legal Korean Set",
          description: "Korean legal dataset",
          tags: ["domain/legal", "quality:seed"],
          rowCount: 1200,
          likeCount: 5,
          downloadCount: 12,
          status: "active",
          language: "ko",
          taskType: "instruction",
          baseModelHint: "qwen3:14b",
          createdAt: { toMillis: () => 20 },
        },
        {
          id: "dataset-2",
          ownerUid: "uid-bob",
          ownerName: "Bob",
          title: "Medical English Set",
          description: "Medical dataset",
          tags: ["domain/medical"],
          rowCount: 500,
          likeCount: 1,
          downloadCount: 40,
          status: "active",
          language: "en",
          taskType: "chat",
          baseModelHint: "mistral",
          createdAt: { toMillis: () => 30 },
        },
        {
          id: "dataset-3",
          ownerUid: "uid-cara",
          ownerName: "Cara",
          title: "Rejected Set",
          description: "Should not show",
          tags: ["domain/legal", "quality:seed"],
          rowCount: 100,
          likeCount: 0,
          downloadCount: 99,
          status: "rejected",
          language: "ko",
          taskType: "instruction",
          baseModelHint: "qwen3:14b",
          createdAt: { toMillis: () => 40 },
        },
      ] as never,
      {
        ownerUid: null,
        language: "ko",
        task: "instruction",
        baseModel: "qwen3:14b",
        tags: ["domain/legal"],
        sort: "newest",
        limit: 24,
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("dataset-1");
  });

  it("prefers tag filtering in the server-side query plan and caps the query size", () => {
    expect(
      buildListDatasetsServerQueryPlan({
        ownerUid: null,
        language: "ko",
        task: "instruction",
        baseModel: "qwen3:14b",
        tags: ["domain/legal"],
        sort: "newest",
        limit: 24,
      }),
    ).toEqual({
      orderField: "createdAt",
      orderDirection: "desc",
      queryLimit: 100,
      serverFilter: {
        field: "tags",
        operator: "array-contains-any",
        value: ["domain/legal"],
      },
    });
  });

  it("uses only active+sort when no narrowing filter is provided", () => {
    expect(
      buildListDatasetsServerQueryPlan({
        ownerUid: null,
        language: null,
        task: null,
        baseModel: null,
        tags: [],
        sort: "popular",
        limit: 24,
      }),
    ).toEqual({
      orderField: "downloadCount",
      orderDirection: "desc",
      queryLimit: 100,
      serverFilter: null,
    });
  });

  it("stores rate-limit state in RTDB transactions instead of Firestore", async () => {
    const transactions: string[] = [];

    const result = await enforceListDatasetsRateLimit(
      {
        database: {
          ref: (path: string) => ({
            transaction: async (updateFn: (current: unknown) => unknown) => {
              transactions.push(path);
              const next = updateFn(null);
              return {
                committed: true,
                snapshot: {
                  val: () => next,
                },
              };
            },
          }),
        } as never,
        clock: {
          now: () =>
            ({
              toMillis: () => 10_000,
            }) as never,
        },
      },
      "u-1",
      "u-1::popular::::::24",
    );

    expect(result).toEqual({ allowed: true });
    expect(transactions).toEqual([
      "_requestRateLimits/listDatasets/u-1::popular::::::24",
    ]);
  });
});
