import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/models/get-model", () => ({
  fetchModelSummaryById: vi.fn(async () => ({
    id: "model-1",
    ownerUid: "uid-1",
    title: "Legal Ko LoRA",
    ownerName: "Alice",
    ownerLabel: "Alice",
    baseModel: "google/gemma-2b-it",
    trainingDatasets: ["dataset-1", "dataset-2"],
    trainingDatasetCount: 2,
    trainingMethod: "lora",
    huggingFaceUrl: "https://huggingface.co/org/model",
    ollamaPullUrl: null,
    pointCost: 30,
    updatedAt: "2026-05-09T00:00:00.000Z",
  })),
}));

vi.mock("@/lib/datasets/get-dataset", () => ({
  fetchDatasetSummaryById: vi.fn(async (datasetId: string) => ({
    id: datasetId,
    title: datasetId === "dataset-1" ? "Legal Korean Set" : "Finance Korean Set",
    description: "",
    ownerUid: "owner-1",
    ownerName: "Alice",
    ownerLabel: "Alice",
    ownerPhotoURL: null,
    tags: [],
    likeCount: 0,
    downloadCount: 0,
    size: { category: "tiny" },
  })),
}));

import { ModelDetailPanel } from "@/components/models/ModelDetailPanel";

describe("ModelDetailPanel", () => {
  it("links training dataset titles to dataset detail pages", async () => {
    render(<ModelDetailPanel modelId="model-1" />);

    await waitFor(() =>
      expect(screen.getByText("Legal Ko LoRA")).toBeInTheDocument(),
    );

    expect(screen.getByRole("link", { name: "Legal Korean Set" })).toHaveAttribute(
      "href",
      "/datasets?dataset=dataset-1#dataset-detail",
    );
    expect(screen.getByRole("link", { name: "Finance Korean Set" })).toHaveAttribute(
      "href",
      "/datasets?dataset=dataset-2#dataset-detail",
    );
  });
});
