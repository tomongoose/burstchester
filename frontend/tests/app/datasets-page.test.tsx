import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

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
  DatasetGrid: () => <div>grid</div>,
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
});
