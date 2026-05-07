import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/datasets/get-dataset", () => ({
  fetchDatasetSummaryById: vi.fn(async () => ({
    id: "gemma4-full-debug-3",
    ownerUid: "uid-1",
    ownerName: "Alice",
    ownerLabel: "Alice",
    title: "Gemma4 Full Debug Dataset 3",
    description: "Debug dataset",
    tags: ["debug", "test"],
    likeCount: 0,
    downloadCount: 20,
    size: { category: "tiny" },
  })),
}));

vi.mock("@/components/datasets/DownloadButton", () => ({
  DownloadButton: ({ datasetId }: { datasetId: string }) => (
    <div data-testid="download-button">{datasetId}</div>
  ),
}));

import { DatasetDetailPanel } from "@/components/datasets/DatasetDetailPanel";

describe("DatasetDetailPanel", () => {
  it("renders dataset details for a selected dataset id", async () => {
    render(<DatasetDetailPanel datasetId="gemma4-full-debug-3" />);

    await waitFor(() =>
      expect(
        screen.getByText("Gemma4 Full Debug Dataset 3"),
      ).toBeInTheDocument(),
    );

    expect(screen.getByText("Debug dataset")).toBeInTheDocument();
    expect(screen.getByTestId("download-button")).toHaveTextContent(
      "gemma4-full-debug-3",
    );
  });
});
