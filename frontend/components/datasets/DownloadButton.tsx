"use client";

import { useState, type JSX } from "react";
import {
  callPrepareDownload,
  triggerBrowserDownload,
  type CallPrepareDownloadDeps,
  type TriggerBrowserDownloadDeps,
} from "@/lib/datasets/download";

type Status = "idle" | "pending" | "error";

interface DownloadButtonProps {
  readonly datasetId: string;
  readonly callable: CallPrepareDownloadDeps["callable"];
  readonly navigate: TriggerBrowserDownloadDeps["navigate"];
}

export function DownloadButton({
  datasetId,
  callable,
  navigate,
}: DownloadButtonProps): JSX.Element {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDownload(): Promise<void> {
    setStatus("pending");
    setErrorMessage(null);
    try {
      const response = await callPrepareDownload({ callable }, datasetId);
      triggerBrowserDownload(response.url, { navigate });
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Download failed.");
    }
  }

  if (status === "error") {
    return (
      <div>
        <p role="alert">Download failed: {errorMessage ?? "Unknown error"}</p>
        <button type="button" onClick={() => void handleDownload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={status === "pending"}
      onClick={() => void handleDownload()}
    >
      {status === "pending" ? "Preparing…" : "Download"}
    </button>
  );
}
