import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const fetchTrendingDatasetSummariesMock = vi.fn();

vi.mock("@/lib/datasets/trending-datasets", () => ({
  fetchTrendingDatasetSummaries: (...args: unknown[]) =>
    fetchTrendingDatasetSummariesMock(...args),
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
    fetchTrendingDatasetSummariesMock.mockReset();
  });

  it("renders trending datasets from a single popular dataset request", async () => {
    fetchTrendingDatasetSummariesMock.mockResolvedValue([summary]);

    render(<FeaturedDatasets />);

    await waitFor(() =>
      expect(screen.getByText("Fallback Dataset")).toBeInTheDocument(),
    );
    expect(fetchTrendingDatasetSummariesMock).toHaveBeenCalledTimes(1);
  });
});
