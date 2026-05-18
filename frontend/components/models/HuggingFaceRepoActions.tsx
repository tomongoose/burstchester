"use client";

import { useState, type JSX, type MouseEvent } from "react";

interface HuggingFaceRepoActionsProps {
  readonly repoUrl: string;
  readonly compact?: boolean;
}

export function HuggingFaceRepoActions({
  repoUrl,
  compact = false,
}: HuggingFaceRepoActionsProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function handleCopy(event: MouseEvent<HTMLButtonElement>): Promise<void> {
    event.stopPropagation();
    await navigator.clipboard.writeText(repoUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-sm">
        <a
          href={repoUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="font-label text-[11px] uppercase tracking-[0.22em] text-primary hover:underline"
        >
          Hugging Face
        </a>
        <button
          type="button"
          onClick={(event) => void handleCopy(event)}
          className="inline-flex items-center gap-1 font-label text-[11px] uppercase tracking-[0.18em] text-on-surface-variant hover:text-primary"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            {copied ? "check" : "content_copy"}
          </span>
          {copied ? "Copied" : "Copy repo"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <a
        href={repoUrl}
        target="_blank"
        rel="noreferrer"
        className="block rounded-lg bg-primary px-md py-3 text-center font-body text-body-sm font-bold text-on-primary transition-opacity hover:opacity-90"
      >
        Open Hugging Face
      </a>
      <button
        type="button"
        onClick={(event) => void handleCopy(event)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant/30 px-md py-3 font-body text-body-sm font-bold text-on-surface transition-colors hover:border-primary hover:text-primary"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          {copied ? "check" : "content_copy"}
        </span>
        {copied ? "Copied repo URL" : "Copy repo URL"}
      </button>
    </div>
  );
}
