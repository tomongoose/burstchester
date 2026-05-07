import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const useSearchParamsMock = vi.fn();
const useDatasetSearchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock("@/lib/datasets/use-dataset-search", () => ({
  useDatasetSearch: (...args: unknown[]) => useDatasetSearchMock(...args),
}));

vi.mock("@/components/site-nav/SiteNav", () => ({
  SiteNav: () => <div>nav</div>,
}));

vi.mock("@/components/site-nav/SiteFooter", () => ({
  SiteFooter: () => <div>footer</div>,
}));

vi.mock("@/components/datasets/CategoryFilter", () => ({
  CategoryFilter: () => <div>filters</div>,
}));

vi.mock("@/components/datasets/DatasetDetailPanel", () => ({
  DatasetDetailPanel: ({ datasetId }: { datasetId: string }) => (
    <div>detail:{datasetId}</div>
  ),
}));

import DatasetsPage from "@/app/datasets/page";
import { buildDatasetSummary } from "@/lib/domain/dataset-summary";

const firstSummary = buildDatasetSummary({
  id: "dataset-1",
  ownerUid: "uid-1",
  ownerName: "Alice",
  title: "Dataset One",
  description: "First dataset",
  tags: ["domain/legal"],
  rowCount: 1000,
  likeCount: 2,
  downloadCount: 10,
  status: "active",
});

const secondSummary = buildDatasetSummary({
  id: "dataset-2",
  ownerUid: "uid-2",
  ownerName: "Bob",
  title: "Dataset Two",
  description: "Second dataset",
  tags: ["domain/finance"],
  rowCount: 500,
  likeCount: 4,
  downloadCount: 12,
  status: "active",
});

describe("Dataset basket page flow", () => {
  beforeEach(() => {
    useSearchParamsMock.mockReset();
    useDatasetSearchMock.mockReset();
    useSearchParamsMock.mockReturnValue({
      get: () => null,
    });
    useDatasetSearchMock.mockReturnValue({
      summaries: [firstSummary, secondSummary],
      loading: false,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => undefined,
      },
    });
  });

  it("lets the user collect datasets and copy the newline-delimited list", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    render(<DatasetsPage />);

    await user.click(screen.getByRole("button", { name: /add dataset one/i }));
    await user.click(screen.getByRole("button", { name: /add dataset two/i }));

    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /copy dataset ids/i }));

    expect(writeTextMock).toHaveBeenCalledWith(
      "dataset-1\ndataset-2\n",
    );
  });
});
