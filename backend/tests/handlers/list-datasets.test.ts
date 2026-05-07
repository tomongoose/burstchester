import { describe, expect, it } from "vitest";

import {
  applyListDatasetsQuery,
  createListDatasetsHandler,
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
  it("returns active dataset summaries from the list executor", async () => {
    const response = createResponse();
    let receivedQuery: unknown;
    const handler = createListDatasetsHandler(STUB_DEPS);

    await handler(
      {
        method: "GET",
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
    );

    expect(receivedQuery).toEqual({
      language: "ko",
      task: null,
      baseModel: null,
      tags: ["domain/legal", "quality:seed"],
      sort: "newest",
      limit: 24,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(response.body).toEqual({
      ok: true,
      datasets: [
        {
          id: "dataset-1",
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

  it("filters and sorts dataset records in memory", () => {
    const result = applyListDatasetsQuery(
      [
        {
          id: "dataset-1",
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
});
