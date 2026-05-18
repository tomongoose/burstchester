import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ModelCard } from "@/components/models/ModelCard";
import { buildModelSummary } from "@/lib/domain/model-summary";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const baseRecord = {
  id: "model-1",
  ownerUid: "uid-1",
  title: "Legal Ko LoRA",
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
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("opens model detail when the card is clicked", async () => {
    const user = userEvent.setup();
    render(<ModelCard model={buildModelSummary(baseRecord)} />);

    await user.click(screen.getByRole("link", { name: /open legal ko lora details/i }));

    expect(pushMock).toHaveBeenCalledWith(
      "/datasets?asset=models&model=model-1#model-detail",
    );
  });

  it("renders the registered model title", () => {
    render(<ModelCard model={buildModelSummary(baseRecord)} />);

    expect(screen.getByRole("link", { name: "Legal Ko LoRA" })).toHaveAttribute(
      "href",
      "/datasets?asset=models&model=model-1#model-detail",
    );
  });

  it("falls back to Untitled when no model title is registered", () => {
    render(<ModelCard model={buildModelSummary({ ...baseRecord, title: "" })} />);

    expect(screen.getByRole("link", { name: "Untitled" })).toBeInTheDocument();
  });

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
