import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ModelCard } from "@/components/models/ModelCard";
import { buildModelSummary } from "@/lib/domain/model-summary";

const baseRecord = {
  id: "model-1",
  ownerUid: "uid-1",
  ownerName: "Alice",
  baseModel: "google/gemma-2-2b",
  trainingDatasets: ["dataset-1"],
  trainingMethod: "qlora" as const,
  huggingFaceUrl: "https://huggingface.co/org/model",
  ollamaPullUrl: null,
  pointCost: 100,
  createdAt: "2026-05-09T00:00:00.000Z",
  updatedAt: "2026-05-09T00:00:00.000Z",
};

describe("ModelCard", () => {
  it("links non-anonymous owners to their public profile", () => {
    render(<ModelCard model={buildModelSummary(baseRecord)} />);

    expect(screen.getByRole("link", { name: /by Alice/i })).toHaveAttribute(
      "href",
      "/profile?user=uid-1",
    );
  });

  it("does not link anonymous owners", () => {
    render(
      <ModelCard
        model={buildModelSummary({
          ...baseRecord,
          ownerName: "",
        })}
      />,
    );

    expect(screen.getByText("by Anonymous")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /by Anonymous/i })).toBeNull();
  });
});
