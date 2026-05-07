import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const useDatasetSearchMock = vi.fn();

vi.mock("@/lib/datasets/use-dataset-search", () => ({
  useDatasetSearch: (...args: unknown[]) => useDatasetSearchMock(...args),
}));

import { FeaturedDatasets } from "@/components/landing/FeaturedDatasets";
import { buildDatasetSummary } from "@/lib/domain/dataset-summary";

const summary = buildDatasetSummary({
  id: "dataset-1",
  ownerName: "Alice",
  title: "Fallback Dataset",
  description: "Shown when seed-tagged datasets are unavailable.",
  tags: ["domain/legal"],
  rowCount: 1000,
  likeCount: 5,
  downloadCount: 20,
  status: "active",
});

describe("FeaturedDatasets", () => {
  beforeEach(() => {
    useDatasetSearchMock.mockReset();
  });

  it("falls back to popular datasets when no seed-tagged datasets exist", () => {
    useDatasetSearchMock
      .mockReturnValueOnce({ summaries: [], loading: false })
      .mockReturnValueOnce({ summaries: [summary], loading: false });

    render(<FeaturedDatasets />);

    expect(screen.getByText("Fallback Dataset")).toBeInTheDocument();
    expect(
      screen.queryByText(/No seed datasets available yet/i),
    ).not.toBeInTheDocument();
  });
});
