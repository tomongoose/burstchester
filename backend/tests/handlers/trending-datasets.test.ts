import { describe, expect, it } from "vitest";

import {
  createListTrendingDatasetsHandler,
  executeRefreshTrendingDatasets,
} from "@/handlers/trending-datasets";

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

const STUB_DEPS = {} as Parameters<typeof createListTrendingDatasetsHandler>[0];

describe("trending dataset handlers", () => {
  it("returns cached trending dataset summaries without auth", async () => {
    const response = createResponse();
    const handler = createListTrendingDatasetsHandler(STUB_DEPS);

    await handler(
      { method: "GET" },
      response as never,
      async () => ({
        updatedAt: 1234,
        datasets: [
          {
            id: "dataset-1",
            ownerName: "Alice",
            title: "Trending Set",
            description: "Popular dataset",
            tags: ["domain/legal"],
            rowCount: 1000,
            likeCount: 7,
            downloadCount: 42,
            status: "active",
          },
        ],
      }) as never,
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(response.body).toEqual({
      ok: true,
      updatedAt: 1234,
      datasets: [
        {
          id: "dataset-1",
          ownerName: "Alice",
          title: "Trending Set",
          description: "Popular dataset",
          tags: ["domain/legal"],
          rowCount: 1000,
          likeCount: 7,
          downloadCount: 42,
          status: "active",
        },
      ],
    });
  });

  it("refreshes the trending dataset cache from top downloaded active datasets", async () => {
    const writes: unknown[] = [];

    await executeRefreshTrendingDatasets(
      {
        db: {
          collection: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  get: async () => ({
                    docs: [
                      {
                        id: "dataset-1",
                        data: () => ({
                          ownerName: "Alice",
                          title: "Trending Set",
                          description: "Popular dataset",
                          tags: ["domain/legal"],
                          rowCount: 1000,
                          likeCount: 7,
                          downloadCount: 42,
                          status: "active",
                        }),
                      },
                    ],
                  }),
                }),
              }),
            }),
          }),
        } as never,
        database: {
          ref: () => ({
            set: async (payload: unknown) => {
              writes.push(payload);
            },
          }),
        } as never,
      },
      777,
    );

    expect(writes).toEqual([
      {
        updatedAt: 777,
        datasets: [
          {
            id: "dataset-1",
            ownerName: "Alice",
            title: "Trending Set",
            description: "Popular dataset",
            tags: ["domain/legal"],
            rowCount: 1000,
            likeCount: 7,
            downloadCount: 42,
            status: "active",
          },
        ],
      },
    ]);
  });
});
