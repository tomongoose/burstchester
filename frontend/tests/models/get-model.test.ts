import { describe, expect, it, vi } from "vitest";

import { fetchModelSummaryById } from "@/lib/models/get-model";

vi.mock("@/lib/datasets/auth-token", () => ({
  getDatasetApiAuthToken: vi.fn(async () => "firebase-id-token"),
}));

describe("fetchModelSummaryById", () => {
  it("loads a model summary from getModel", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({
        ok: true,
        model: {
          id: "model-1",
          ownerUid: "user-1",
          title: "Legal Ko LoRA",
          ownerName: "Alice",
          baseModel: "google/gemma-2-2b",
          trainingDatasets: ["dataset-1"],
          trainingMethod: "qlora",
          huggingFaceUrl: "https://huggingface.co/org/model/resolve/main/model.gguf",
          ollamaPullUrl: null,
          pointCost: 100,
          createdAt: "2026-05-09T00:00:00.000Z",
          updatedAt: "2026-05-09T00:00:00.000Z",
        },
      }),
      { status: 200 },
    ));

    const model = await fetchModelSummaryById(
      "model-1",
      fetchImpl,
      "https://functions.example/getModel",
    );

    expect(model).toEqual(
      expect.objectContaining({
        id: "model-1",
        title: "Legal Ko LoRA",
        ownerLabel: "Alice",
        baseModel: "google/gemma-2-2b",
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://functions.example/getModel?modelId=model-1",
      {
        headers: {
          Authorization: "Bearer firebase-id-token",
        },
      },
    );
  });

  it("returns null for missing models", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ ok: false, error: "Model not found." }),
      { status: 404 },
    ));

    await expect(
      fetchModelSummaryById("missing", fetchImpl, "https://functions.example/getModel"),
    ).resolves.toBeNull();
  });
});
