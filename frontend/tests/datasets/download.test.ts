import { describe, expect, it, vi } from "vitest";
import {
  callPrepareDownload,
  triggerBrowserDownload,
  type CallPrepareDownloadDeps,
  type PrepareDownloadResponse,
} from "@/lib/datasets/download";

function fakeCallable(
  response: PrepareDownloadResponse,
): {
  callable: CallPrepareDownloadDeps["callable"];
  invocations: Array<{ datasetId: string }>;
} {
  const invocations: Array<{ datasetId: string }> = [];
  const callable = async (data: { datasetId: string }) => {
    invocations.push(data);
    return { data: response };
  };
  return { callable, invocations };
}

describe("callPrepareDownload", () => {
  it("invokes the callable with the dataset id", async () => {
    const { callable, invocations } = fakeCallable({
      cached: false,
      zipPath: "downloads/ds-1/ds-1.zip",
      url: "https://signed/ds-1.zip",
    });

    await callPrepareDownload({ callable }, "ds-1");

    expect(invocations).toEqual([{ datasetId: "ds-1" }]);
  });

  it("returns the url and metadata from the callable response", async () => {
    const { callable } = fakeCallable({
      cached: true,
      zipPath: "downloads/ds-1/ds-1.zip",
      url: "https://signed/ds-1.zip",
    });

    const result = await callPrepareDownload({ callable }, "ds-1");

    expect(result.url).toBe("https://signed/ds-1.zip");
    expect(result.cached).toBe(true);
  });

  it("propagates the callable error", async () => {
    const callable = async () => {
      throw new Error("permission-denied");
    };

    await expect(callPrepareDownload({ callable }, "ds-1")).rejects.toThrow(/permission-denied/);
  });
});

describe("triggerBrowserDownload", () => {
  it("calls navigate with the provided url", () => {
    const navigate = vi.fn();

    triggerBrowserDownload("https://signed/ds-1.zip", { navigate });

    expect(navigate).toHaveBeenCalledWith("https://signed/ds-1.zip");
  });

  it("rejects empty url", () => {
    const navigate = vi.fn();

    expect(() => triggerBrowserDownload("", { navigate })).toThrow(/empty/i);
    expect(navigate).not.toHaveBeenCalled();
  });
});
