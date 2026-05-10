import { describe, expect, it, vi } from "vitest";

import { fetchModelSummaries } from "@/lib/models/list-models";

vi.mock("@/lib/datasets/auth-token", () => ({
  getDatasetApiAuthToken: vi.fn(async () => "firebase-id-token"),
}));

describe("fetchModelSummaries", () => {
  it("loads model summaries from listModels", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({
        ok: true,
        models: [
          {
            id: "model-1",
            ownerUid: "user-1",
            ownerName: "Alice",
            baseModel: "Qwen/Qwen3-0.6B",
            trainingDatasets: ["dataset-1"],
            trainingMethod: "qlora",
            huggingFaceUrl: "https://huggingface.co/org/model/resolve/main/model.gguf",
            ollamaPullUrl: null,
            pointCost: 100,
            createdAt: "2026-05-09T00:00:00.000Z",
            updatedAt: "2026-05-09T00:00:00.000Z",
          },
        ],
      }),
      { status: 200 },
    ));

    const models = await fetchModelSummaries(
      { sort: "newest" },
      fetchImpl,
      "https://functions.example/listModels",
    );

    expect(models).toEqual([
      expect.objectContaining({
        id: "model-1",
        ownerLabel: "Alice",
        baseModel: "Qwen/Qwen3-0.6B",
        trainingDatasetCount: 1,
        pointCost: 100,
      }),
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://functions.example/listModels?sort=newest&limit=24",
      {
        headers: {
          Authorization: "Bearer firebase-id-token",
        },
      },
    );
  });

  it("can request models scoped to a profile owner", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, models: [] }),
      { status: 200 },
    ));

    await fetchModelSummaries(
      { sort: "newest", ownerUid: "profile-owner" },
      fetchImpl,
      "https://functions.example/listModels",
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://functions.example/listModels?sort=newest&ownerUid=profile-owner&limit=24",
      expect.any(Object),
    );
  });
});
