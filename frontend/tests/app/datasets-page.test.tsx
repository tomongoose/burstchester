import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@/components/datasets/DatasetGrid", () => ({
  DatasetGrid: ({
    onToggleSelect,
  }: {
    onToggleSelect: (datasetId: string) => void;
  }) => (
    <button type="button" onClick={() => onToggleSelect("ds-1")}>
      select dataset
    </button>
  ),
}));

vi.mock("@/components/datasets/DatasetDetailPanel", () => ({
  DatasetDetailPanel: ({ datasetId }: { datasetId: string }) => (
    <div>detail:{datasetId}</div>
  ),
}));

import DatasetsPage from "@/app/datasets/page";

describe("DatasetsPage", () => {
  beforeEach(() => {
    useDatasetSearchMock.mockReset();
    useSearchParamsMock.mockReset();
    useDatasetSearchMock.mockReturnValue({
      summaries: [],
      loading: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scrolls the selected dataset detail into view when the query param is present", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => (key === "dataset" ? "ds-1" : null),
    });

    render(<DatasetsPage />);

    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("shows the selection tray after a dataset is added", async () => {
    useSearchParamsMock.mockReturnValue({
      get: () => null,
    });
    const user = userEvent.setup();

    render(<DatasetsPage />);
    await user.click(screen.getByRole("button", { name: /select dataset/i }));

    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    expect(screen.getByText("ds-1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy dataset ids/i }),
    ).toBeInTheDocument();
  });

  it("removes a dataset from the tray when delete is clicked", async () => {
    useSearchParamsMock.mockReturnValue({
      get: () => null,
    });
    const user = userEvent.setup();

    render(<DatasetsPage />);
    await user.click(screen.getByRole("button", { name: /select dataset/i }));
    await user.click(screen.getByRole("button", { name: /remove ds-1/i }));

    expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();
    expect(screen.queryByText("ds-1")).not.toBeInTheDocument();
  });
});
