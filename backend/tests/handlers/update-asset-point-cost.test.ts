import { describe, expect, it } from "vitest";

import { createUpdateAssetPointCostHandler } from "@/handlers/update-asset-point-cost";

interface ResponseStub {
  statusCode: number;
  body: unknown;
  status(code: number): ResponseStub;
  json(payload: unknown): ResponseStub;
}

function createResponse(): ResponseStub {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("updateAssetPointCostHandler", () => {
  it("updates a dataset price for its owner", async () => {
    const response = createResponse();
    const updates: Array<{ uid: string; assetType: string; assetId: string; pointCost: number }> = [];
    const handler = createUpdateAssetPointCostHandler({
      verifyIdToken: async () => ({ uid: "user-1" }),
      updateAssetPointCost: async (input) => {
        updates.push(input);
      },
    });

    await handler(
      {
        headers: { authorization: "Bearer token" },
        body: {
          assetType: "dataset",
          assetId: "dataset-1",
          pointCost: 25,
        },
      },
      response as never,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      assetType: "dataset",
      assetId: "dataset-1",
      pointCost: 25,
    });
    expect(updates).toEqual([
      {
        uid: "user-1",
        assetType: "dataset",
        assetId: "dataset-1",
        pointCost: 25,
      },
    ]);
  });
});
