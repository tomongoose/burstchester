"use client";

import { useState, type JSX } from "react";
import { serializeSelectedDatasetIds } from "@/lib/datasets/selection-list";

interface DatasetSelectionTrayProps {
  readonly selectedDatasetIds: readonly string[];
  readonly onRemoveDataset: (datasetId: string) => void;
}

export function DatasetSelectionTray({
  selectedDatasetIds,
  onRemoveDataset,
}: DatasetSelectionTrayProps): JSX.Element | null {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  if (selectedDatasetIds.length === 0) return null;

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(
      serializeSelectedDatasetIds(selectedDatasetIds),
    );
    setCopied(true);
  }

  return (
    <aside className="fixed bottom-6 right-6 z-40 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-primary/20 bg-surface-container p-4 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-label text-[11px] uppercase tracking-[0.22em] text-primary">
            Dataset IDs for CLI
          </p>
          <p className="mt-1 font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
            {selectedDatasetIds.length} selected
          </p>
        </div>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand tray" : "Collapse tray"}
          onClick={() => setCollapsed((current) => !current)}
          className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 font-label text-[10px] uppercase tracking-[0.2em] text-on-surface hover:border-primary/40 hover:text-primary"
        >
          <span className="material-symbols-outlined text-base">
            {collapsed ? "keyboard_arrow_up" : "keyboard_arrow_down"}
          </span>
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>
      {!collapsed ? (
        <>
          <p className="mt-3 text-xs text-on-surface-variant">
            Paste into CLI: <code>dataset-list add --dataset-id</code>
          </p>
          <ul className="mt-3 max-h-32 space-y-2 overflow-auto font-mono text-sm text-on-surface-variant">
          {selectedDatasetIds.map((datasetId) => (
            <li
              key={datasetId}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-surface-container-high/60 px-3 py-2"
            >
              <span className="truncate">{datasetId}</span>
              <button
                type="button"
                aria-label={`Remove ${datasetId}`}
                onClick={() => onRemoveDataset(datasetId)}
                className="inline-flex shrink-0 items-center rounded-full border border-white/10 p-1 text-on-surface-variant hover:border-primary/40 hover:text-primary"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </li>
          ))}
          </ul>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-label text-[11px] uppercase tracking-[0.22em] text-on-primary"
      >
        <span className="material-symbols-outlined text-base">
          {copied ? "check" : "content_copy"}
        </span>
        {copied ? "Copied" : "Copy dataset IDs"}
      </button>
    </aside>
  );
}
