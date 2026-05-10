import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DownloadButton } from "@/components/datasets/DownloadButton";
import type { CallPrepareDownloadDeps, TriggerBrowserDownloadDeps } from "@/lib/datasets/download";

function makeDeps(overrides: {
  callable?: CallPrepareDownloadDeps["callable"];
  navigate?: TriggerBrowserDownloadDeps["navigate"];
} = {}) {
  const calls: Array<{ datasetId: string }> = [];
  const navigations: string[] = [];
  const callable: CallPrepareDownloadDeps["callable"] =
    overrides.callable ??
    (async (data) => {
      calls.push(data);
      return {
        data: {
          cached: false,
          zipPath: `downloads/${data.datasetId}/${data.datasetId}.zip`,
          url: `https://signed/${data.datasetId}.zip`,
        },
      };
    });
  const navigate: TriggerBrowserDownloadDeps["navigate"] =
    overrides.navigate ??
    ((url: string) => {
      navigations.push(url);
    });
  return { callable, navigate, calls, navigations };
}

describe("DownloadButton", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the idle Download label initially", () => {
    const deps = makeDeps();
    render(<DownloadButton datasetId="ds-1" callable={deps.callable} navigate={deps.navigate} />);

    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
  });

  it("calls prepareDownload with the dataset id when clicked", async () => {
    const deps = makeDeps();
    const user = userEvent.setup();
    render(<DownloadButton datasetId="ds-1" callable={deps.callable} navigate={deps.navigate} />);

    await user.click(screen.getByRole("button", { name: /download/i }));

    await waitFor(() => expect(deps.calls).toEqual([{ datasetId: "ds-1" }]));
  });

  it("shows pending state (disabled + Preparing) during the call", async () => {
    let resolveCall!: (value: { data: { cached: boolean; zipPath: string; url: string } }) => void;
    const deps = makeDeps({
      callable: () =>
        new Promise((resolve) => {
          resolveCall = resolve;
        }),
    });
    const user = userEvent.setup();
    render(<DownloadButton datasetId="ds-1" callable={deps.callable} navigate={deps.navigate} />);

    await user.click(screen.getByRole("button", { name: /download/i }));

    const pending = await screen.findByRole("button", { name: /preparing/i });
    expect(pending).toBeDisabled();

    resolveCall({ data: { cached: false, zipPath: "p", url: "https://x" } });
    await waitFor(() => expect(deps.navigations).toEqual(["https://x"]));
  });

  it("triggers browser navigation on success", async () => {
    const deps = makeDeps();
    const user = userEvent.setup();
    render(<DownloadButton datasetId="ds-1" callable={deps.callable} navigate={deps.navigate} />);

    await user.click(screen.getByRole("button", { name: /download/i }));

    await waitFor(() => expect(deps.navigations).toEqual(["https://signed/ds-1.zip"]));
  });

  it("caches the remaining point balance when the backend returns it", async () => {
    const deps = makeDeps({
      callable: async (data) => ({
        data: {
          cached: false,
          zipPath: `downloads/${data.datasetId}/${data.datasetId}.zip`,
          url: `https://signed/${data.datasetId}.zip`,
          remainingPoints: 9975,
        },
      }),
    });
    const user = userEvent.setup();
    render(<DownloadButton datasetId="ds-1" callable={deps.callable} navigate={deps.navigate} />);

    await user.click(screen.getByRole("button", { name: /download/i }));

    await waitFor(() => {
      expect(window.localStorage.getItem("burstchester:point-balance")).toBe("9975");
    });
  });

  it("renders an error message and a retry button on failure", async () => {
    const deps = makeDeps({
      callable: async () => {
        throw new Error("permission-denied");
      },
    });
    const user = userEvent.setup();
    render(<DownloadButton datasetId="ds-1" callable={deps.callable} navigate={deps.navigate} />);

    await user.click(screen.getByRole("button", { name: /download/i }));

    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(deps.navigations).toEqual([]);
  });

  it("returns to idle/pending after a retry click", async () => {
    let attempt = 0;
    const deps = makeDeps({
      callable: async (data) => {
        attempt += 1;
        if (attempt === 1) throw new Error("network");
        return {
          data: { cached: false, zipPath: "p", url: `https://signed/${data.datasetId}.zip` },
        };
      },
    });
    const user = userEvent.setup();
    render(<DownloadButton datasetId="ds-1" callable={deps.callable} navigate={deps.navigate} />);

    await user.click(screen.getByRole("button", { name: /download/i }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(deps.navigations).toEqual(["https://signed/ds-1.zip"]));
  });
});
