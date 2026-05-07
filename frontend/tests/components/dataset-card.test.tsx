import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DatasetCard } from "@/components/datasets/DatasetCard";
import { buildDatasetSummary } from "@/lib/domain/dataset-summary";

const baseRecord = {
  id: "ds-1",
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
    render(<DatasetCard summary={summary} />);

    expect(screen.getByText("Korean Legal Q&A")).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/small/i)).toBeInTheDocument();
  });

  it("renders at most 5 tag chips even when more tags exist", () => {
    const summary = buildDatasetSummary(baseRecord);
    render(<DatasetCard summary={summary} />);

    const chips = screen.getAllByTestId("tag-chip");
    expect(chips).toHaveLength(5);
  });

  it("renders like and download counts with formatted labels", () => {
    const summary = buildDatasetSummary(baseRecord);
    render(<DatasetCard summary={summary} />);

    expect(screen.getByText(/12.*likes?/i)).toBeInTheDocument();
    expect(screen.getByText(/47.*downloads?/i)).toBeInTheDocument();
  });
});
