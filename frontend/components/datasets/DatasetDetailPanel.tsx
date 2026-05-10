"use client";

import Link from "next/link";
import { useEffect, useState, type JSX } from "react";
import type { DatasetSummary } from "@/lib/domain/dataset-summary";
import { resolveDatasetBackendBaseUrl } from "@/lib/datasets/list-datasets";
import { buildDatasetJsonLd } from "@/lib/datasets/seo";
import { fetchDatasetSummaryById } from "@/lib/datasets/get-dataset";
import { DownloadButton } from "@/components/datasets/DownloadButton";
import type { PrepareDownloadResponse } from "@/lib/datasets/download";
import { requestPrepareDownloadHttp } from "@/lib/datasets/prepare-download-http";

interface DatasetDetailPanelProps {
  readonly datasetId: string;
}

export function DatasetDetailPanel({
  datasetId,
}: DatasetDetailPanelProps): JSX.Element {
  const [state, setState] = useState<{
    readonly resolvedDatasetId: string | null;
    readonly summary: DatasetSummary | null;
  }>({
    resolvedDatasetId: null,
    summary: null,
  });

  useEffect(() => {
    if (!datasetId) {
      return;
    }

    let cancelled = false;

    void fetchDatasetSummaryById(datasetId)
      .then((next) => {
        if (cancelled) return;
        setState({
          resolvedDatasetId: datasetId,
          summary: next,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          resolvedDatasetId: datasetId,
          summary: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  if (!datasetId) return <></>;

  const loaded = state.resolvedDatasetId === datasetId;
  const summary = loaded ? state.summary : null;

  if (!loaded) {
    return (
      <section className="rounded-xl border border-outline-variant/20 bg-surface-container p-8">
        <div className="h-8 w-64 animate-pulse rounded bg-surface-container-high" />
        <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-surface-container-high" />
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="rounded-xl border border-outline-variant/20 bg-surface-container p-8 text-center">
        <h2 className="font-h2 text-h3 text-on-surface">Dataset not found</h2>
        <p className="mt-3 font-body text-body-md text-on-surface-variant">
          The selected dataset does not exist or is no longer available.
        </p>
      </section>
    );
  }

  const ld = buildDatasetJsonLd(summary);
  const callable = async (data: { datasetId: string }) => {
    const result: PrepareDownloadResponse = await requestPrepareDownloadHttp(
      data.datasetId,
      fetch,
      `${resolveDatasetBackendBaseUrl()}/prepareDatasetDownload`,
    );
    return { data: result };
  };

  return (
    <section className="rounded-xl border border-outline-variant/20 bg-surface-container p-8 md:p-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/datasets"
          className="font-label text-label uppercase tracking-[0.24em] text-on-surface-variant transition-colors hover:text-primary"
        >
          Datasets
        </Link>
        <span className="text-outline-variant">/</span>
        <span className="font-label text-label uppercase tracking-[0.24em] text-primary">
          Detail
        </span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.8fr)_320px]">
        <div className="space-y-6">
          <div>
            <h2 className="font-h1 text-[clamp(2.25rem,4vw,3.75rem)] leading-[1.05] tracking-[-0.03em] text-on-surface">
              {summary.title}
            </h2>
            <p className="mt-3 font-body text-body-md text-on-surface-variant">
              by <span className="text-on-surface">{summary.ownerLabel}</span>
            </p>
          </div>

          <p className="max-w-3xl font-body text-body-lg text-on-surface-variant">
            {summary.description || "No description provided."}
          </p>

          <ul aria-label="tags" className="flex flex-wrap gap-2">
            {summary.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-primary/30 px-3 py-1 font-label text-[11px] uppercase tracking-[0.2em] text-primary"
              >
                {tag}
              </li>
            ))}
          </ul>

          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Meta label="Size" value={summary.size.category} />
            <Meta label="Likes" value={String(summary.likeCount)} />
            <Meta label="Downloads" value={String(summary.downloadCount)} />
            <Meta label="Dataset ID" value={summary.id.slice(0, 8)} mono />
          </dl>
        </div>

        <aside className="space-y-4 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6">
          <DownloadButton
            datasetId={summary.id}
            callable={callable}
            navigate={(url) => window.location.assign(url)}
          />
          <p className="font-label text-label uppercase tracking-[0.2em] text-on-surface-variant">
            Includes Modelfile.template + README.md + LICENSE
          </p>
        </aside>
      </div>
    </section>
  );
}

function Meta({
  label,
  value,
  mono = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}): JSX.Element {
  return (
    <div className="rounded border border-outline-variant/20 bg-surface-container-lowest p-4">
      <dt className="font-label text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
        {label}
      </dt>
      <dd
        className={[
          "mt-2 text-lg font-semibold text-on-surface",
          mono ? "font-mono" : "font-body",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
