import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DatasetCard } from "@/components/datasets/DatasetCard";
import { buildDatasetSummary } from "@/lib/domain/dataset-summary";

const baseRecord = {
  id: "ds-1",
  ownerUid: "uid-1",
  ownerName: "Alice",
  title: "Korean Legal Q&A",
  description: "한국 법률 데이터셋",
  tags: ["legal", "korean", "qa", "instruction", "korean-rrn", "extra-tag"],
  rowCount: 500,
  likeCount: 12,
  downloadCount: 47,
  status: "active",
};

describe("DatasetCard", () => {
  it("renders title, owner name and dataset size category label", () => {
    const summary = buildDatasetSummary(baseRecord);
    render(
      <DatasetCard
        summary={summary}
        selected={false}
        onToggleSelect={() => undefined}
      />,
    );

    expect(screen.getByText("Korean Legal Q&A")).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/small/i)).toBeInTheDocument();
  });

  it("renders at most 3 tag chips even when more tags exist", () => {
    const summary = buildDatasetSummary(baseRecord);
    render(
      <DatasetCard
        summary={summary}
        selected={false}
        onToggleSelect={() => undefined}
      />,
    );

    const chips = screen.getAllByTestId("tag-chip");
    expect(chips).toHaveLength(3);
  });

  it("renders like and download counts", () => {
    const summary = buildDatasetSummary(baseRecord);
    render(
      <DatasetCard
        summary={summary}
        selected={false}
        onToggleSelect={() => undefined}
      />,
    );

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
  });

  it("links to the static dataset detail route using a query param and anchor", () => {
    const summary = buildDatasetSummary(baseRecord);
    render(
      <DatasetCard
        summary={summary}
        selected={false}
        onToggleSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("link", { name: /Korean Legal Q&A/i })).toHaveAttribute(
      "href",
      "/datasets?dataset=ds-1#dataset-detail",
    );
  });

  it("links non-anonymous owners to their public profile", () => {
    const summary = buildDatasetSummary(baseRecord);
    render(
      <DatasetCard
        summary={summary}
        selected={false}
        onToggleSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("link", { name: /by Alice/i })).toHaveAttribute(
      "href",
      "/profile?user=uid-1",
    );
  });

  it("does not link anonymous owners", () => {
    const summary = buildDatasetSummary({
      ...baseRecord,
      ownerName: "Anonymous",
    });
    render(
      <DatasetCard
        summary={summary}
        selected={false}
        onToggleSelect={() => undefined}
      />,
    );

    expect(screen.getByText("by Anonymous")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /by Anonymous/i })).toBeNull();
  });

  it("renders a dataset selection toggle", () => {
    const summary = buildDatasetSummary(baseRecord);
    render(
      <DatasetCard
        summary={summary}
        selected={false}
        onToggleSelect={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: /add korean legal q&a/i }),
    ).toBeInTheDocument();
  });

  it("shows Selected label when the dataset is already in the basket", () => {
    const summary = buildDatasetSummary(baseRecord);
    render(
      <DatasetCard
        summary={summary}
        selected
        onToggleSelect={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: /remove korean legal q&a/i }),
    ).toHaveTextContent("Selected");
  });
});
