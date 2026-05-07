import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DatasetSelectionTray } from "@/components/datasets/DatasetSelectionTray";

describe("DatasetSelectionTray", () => {
  it("does not render when nothing is selected", () => {
    const { container } = render(
      <DatasetSelectionTray
        selectedDatasetIds={[]}
        onRemoveDataset={() => undefined}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("can collapse and expand the selected dataset list", async () => {
    const user = userEvent.setup();
    render(
      <DatasetSelectionTray
        selectedDatasetIds={["ds-1", "ds-2"]}
        onRemoveDataset={() => undefined}
      />,
    );

    expect(screen.getByText("ds-1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /collapse tray/i }));
    expect(screen.queryByText("ds-1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /expand tray/i }));
    expect(screen.getByText("ds-1")).toBeInTheDocument();
  });

  it("removes a selected dataset from the list", async () => {
    const user = userEvent.setup();
    const onRemoveDataset = vi.fn();

    render(
      <DatasetSelectionTray
        selectedDatasetIds={["ds-1"]}
        onRemoveDataset={onRemoveDataset}
      />,
    );

    await user.click(screen.getByRole("button", { name: /remove ds-1/i }));
    expect(onRemoveDataset).toHaveBeenCalledWith("ds-1");
  });

  it("labels the copied values as dataset IDs for CLI usage", () => {
    render(
      <DatasetSelectionTray
        selectedDatasetIds={["ds-1"]}
        onRemoveDataset={() => undefined}
      />,
    );

    expect(screen.getByText(/dataset ids for cli/i)).toBeInTheDocument();
    expect(screen.getByText(/paste into cli:/i)).toBeInTheDocument();
    expect(screen.getByText("dataset-list add --dataset-id")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy dataset ids/i })).toBeInTheDocument();
  });
});
