"use client";

import { useState, type JSX } from "react";
import { serializeSelectedDatasetIds } from "@/lib/datasets/selection-list";

interface DatasetSelectionTrayProps {
  readonly selectedDatasetIds: readonly string[];
}

export function DatasetSelectionTray({
  selectedDatasetIds,
}: DatasetSelectionTrayProps): JSX.Element | null {
  const [copied, setCopied] = useState(false);

  if (selectedDatasetIds.length === 0) return null;

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(
      serializeSelectedDatasetIds(selectedDatasetIds),
    );
    setCopied(true);
  }

  return (
    <aside className="fixed bottom-6 right-6 z-40 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-primary/20 bg-surface-container p-4 shadow-2xl backdrop-blur">
      <p className="font-label text-[11px] uppercase tracking-[0.22em] text-primary">
        {selectedDatasetIds.length} selected
      </p>
      <ul className="mt-3 max-h-32 space-y-1 overflow-auto font-mono text-sm text-on-surface-variant">
        {selectedDatasetIds.map((datasetId) => (
          <li key={datasetId}>{datasetId}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-label text-[11px] uppercase tracking-[0.22em] text-on-primary"
      >
        <span className="material-symbols-outlined text-base">
          {copied ? "check" : "content_copy"}
        </span>
        {copied ? "Copied" : "Copy list"}
      </button>
    </aside>
  );
}
