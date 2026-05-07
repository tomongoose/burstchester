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
      <div className="rounded-xl border border-error/40 bg-error-container/40 p-md">
        <p
          role="alert"
          className="font-body text-body-md text-on-error-container"
        >
          Download failed: {errorMessage ?? "Unknown error"}
        </p>
        <button
          type="button"
          onClick={() => void handleDownload()}
          className="mt-sm inline-flex items-center gap-xs rounded-lg bg-primary px-4 py-2 font-body text-body-md font-bold text-on-primary"
        >
          <span className="material-symbols-outlined">refresh</span>
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
      className="inline-flex w-full items-center justify-center gap-sm rounded-xl bg-primary px-lg py-3 font-body text-body-lg font-bold text-on-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="material-symbols-outlined">download</span>
      {status === "pending" ? "Preparing…" : "Download .zip"}
    </button>
  );
}
