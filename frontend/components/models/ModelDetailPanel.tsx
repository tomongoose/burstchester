"use client";

import Link from "next/link";
import { useEffect, useState, type JSX } from "react";
import type { ModelSummary } from "@/lib/domain/model-summary";
import { fetchModelSummaryById } from "@/lib/models/get-model";
import { toHuggingFaceRepoUrl } from "@/lib/models/huggingface-url";
import { HuggingFaceRepoActions } from "./HuggingFaceRepoActions";

interface ModelDetailPanelProps {
  readonly modelId: string;
}

export function ModelDetailPanel({ modelId }: ModelDetailPanelProps): JSX.Element {
  const [state, setState] = useState<{
    readonly resolvedModelId: string | null;
    readonly model: ModelSummary | null;
  }>({
    resolvedModelId: null,
    model: null,
  });

  useEffect(() => {
    if (!modelId) return;
    let cancelled = false;

    void fetchModelSummaryById(modelId)
      .then((next) => {
        if (cancelled) return;
        setState({ resolvedModelId: modelId, model: next });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ resolvedModelId: modelId, model: null });
      });

    return () => {
      cancelled = true;
    };
  }, [modelId]);

  if (!modelId) return <></>;

  const loaded = state.resolvedModelId === modelId;
  const model = loaded ? state.model : null;
  const huggingFaceRepoUrl = model ? toHuggingFaceRepoUrl(model.huggingFaceUrl) : "";

  if (!loaded) {
    return (
      <section className="rounded-xl border border-outline-variant/20 bg-surface-container p-8">
        <div className="h-8 w-64 animate-pulse rounded bg-surface-container-high" />
        <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-surface-container-high" />
      </section>
    );
  }

  if (!model) {
    return (
      <section className="rounded-xl border border-outline-variant/20 bg-surface-container p-8 text-center">
        <h2 className="font-h2 text-h3 text-on-surface">Model not found</h2>
        <p className="mt-3 font-body text-body-md text-on-surface-variant">
          The selected model does not exist or is no longer available.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-outline-variant/20 bg-surface-container p-8 md:p-10">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/datasets?asset=models"
          className="font-label text-label uppercase tracking-[0.24em] text-on-surface-variant transition-colors hover:text-primary"
        >
          Models
        </Link>
        <span className="text-outline-variant">/</span>
        <span className="font-label text-label uppercase tracking-[0.24em] text-primary">
          Detail
        </span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.8fr)_320px]">
        <div className="space-y-6">
          <div>
            <p className="font-label text-label uppercase tracking-[0.24em] text-primary">
              {model.trainingMethod} model
            </p>
            <h2 className="mt-2 break-words font-h1 text-[clamp(2.25rem,4vw,3.75rem)] leading-[1.05] text-on-surface">
              {model.title}
            </h2>
            <p className="mt-3 font-body text-body-md text-on-surface-variant">
              by <span className="text-on-surface">{model.ownerLabel}</span>
            </p>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Meta label="Base" value={model.baseModel} />
            <Meta label="Datasets" value={String(model.trainingDatasetCount)} />
            <Meta label="Price" value={`${model.pointCost} pts`} />
            <Meta label="Updated" value={formatDate(model.updatedAt)} />
          </dl>
        </div>

        <aside className="space-y-4 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6">
          <HuggingFaceRepoActions repoUrl={huggingFaceRepoUrl} />
          {model.ollamaPullUrl ? (
            <code className="block rounded-lg border border-outline-variant/20 bg-background px-sm py-2 font-mono text-xs text-on-surface-variant">
              {model.ollamaPullUrl}
            </code>
          ) : null}
          <p className="font-label text-label uppercase tracking-[0.2em] text-on-surface-variant">
            Model access records point usage before external download.
          </p>
        </aside>
      </div>
    </section>
  );
}

function Meta({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="rounded border border-outline-variant/20 bg-surface-container-lowest p-4">
      <dt className="font-label text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
        {label}
      </dt>
      <dd className="mt-2 break-words font-body text-lg font-semibold text-on-surface">
        {value}
      </dd>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
