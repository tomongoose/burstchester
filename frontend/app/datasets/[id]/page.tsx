"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDb, getFirebaseFunctions } from "@/lib/firebase";
import {
  buildDatasetSummary,
  type DatasetSummary,
} from "@/lib/domain/dataset-summary";
import { buildDatasetJsonLd } from "@/lib/datasets/seo";
import { DownloadButton } from "@/components/datasets/DownloadButton";
import { SiteNav } from "@/components/site-nav/SiteNav";
import { SiteFooter } from "@/components/site-nav/SiteFooter";
import type { PrepareDownloadResponse } from "@/lib/datasets/download";

export default function DatasetDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    const ref = doc(getDb(), "datasets", id);
    return onSnapshot(ref, (snap) => {
      setLoaded(true);
      if (!snap.exists()) {
        setSummary(null);
        return;
      }
      const data = snap.data() as Parameters<typeof buildDatasetSummary>[0];
      setSummary(buildDatasetSummary({ ...data, id: snap.id }));
    });
  }, [id]);

  const callable = useMemo(() => {
    const fn = httpsCallable<{ datasetId: string }, PrepareDownloadResponse>(
      getFirebaseFunctions(),
      "prepareDownload",
    );
    return async (data: { datasetId: string }) => {
      const result = await fn(data);
      return { data: result.data };
    };
  }, []);

  if (!loaded) {
    return (
      <>
        <SiteNav active="datasets" />
        <main className="flex-1 pt-16">
          <div className="mx-auto max-w-container-max px-gutter py-xl">
            <div className="h-8 w-72 animate-pulse rounded bg-surface-container-high" />
            <div className="mt-md h-4 w-1/2 animate-pulse rounded bg-surface-container" />
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!summary) {
    return (
      <>
        <SiteNav active="datasets" />
        <main className="flex-1 pt-16">
          <div className="mx-auto max-w-container-max px-gutter py-xl text-center">
            <h1 className="font-h2 text-h2 text-on-surface">Dataset not found</h1>
            <p className="mt-md font-body text-body-md text-on-surface-variant">
              The dataset you’re looking for doesn’t exist or has been removed.
            </p>
            <Link
              href="/datasets"
              className="mt-lg inline-flex items-center gap-xs font-body text-body-md font-bold text-primary hover:translate-x-1"
            >
              <span className="material-symbols-outlined">arrow_back</span>
              Browse all datasets
            </Link>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const ld = buildDatasetJsonLd(summary);

  return (
    <>
      <SiteNav active="datasets" />
      <main className="flex-1 pt-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />

        <div className="mx-auto max-w-container-max px-gutter py-md">
          <nav
            aria-label="breadcrumb"
            className="font-label text-label uppercase tracking-widest text-on-surface-variant"
          >
            <Link href="/datasets" className="hover:text-primary">
              Datasets
            </Link>
            <span className="px-2">/</span>
            <span className="text-on-surface">{summary.title}</span>
          </nav>
        </div>

        <section className="mx-auto max-w-container-max px-gutter pb-xl">
          <div className="grid gap-xl rounded-xl border border-outline-variant/30 bg-surface-container-low p-xl lg:grid-cols-[2fr_1fr]">
            <div className="space-y-lg">
              <div>
                <h1 className="font-h1 text-h1 text-on-surface">
                  {summary.title}
                </h1>
                <p className="mt-md font-body text-body-md text-on-surface-variant">
                  by{" "}
                  <span className="text-on-surface">{summary.ownerName}</span>
                </p>
              </div>

              <p className="font-body text-body-lg text-on-surface-variant">
                {summary.description || "No description provided."}
              </p>

              <ul aria-label="tags" className="flex flex-wrap gap-xs">
                {summary.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded bg-surface-variant px-2 py-1 font-label text-label uppercase tracking-widest text-primary"
                  >
                    {tag}
                  </li>
                ))}
              </ul>

              <dl className="grid grid-cols-2 gap-md sm:grid-cols-4">
                <Meta label="Size" value={summary.size.category} />
                <Meta label="Likes" value={String(summary.likeCount)} />
                <Meta
                  label="Downloads"
                  value={String(summary.downloadCount)}
                />
                <Meta label="ID" value={summary.id.slice(0, 8)} mono />
              </dl>
            </div>

            <aside className="space-y-md">
              <DownloadButton
                datasetId={summary.id}
                callable={callable}
                navigate={(url) => window.location.assign(url)}
              />
              <p className="font-label text-label uppercase tracking-widest text-on-surface-variant">
                Includes Modelfile.template + README.md + LICENSE
              </p>
              <a
                href="https://colab.research.google.com/github/burstchester/seed-notebook/blob/main/unsloth_ollama.ipynb"
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-sm rounded-xl border border-outline-variant px-lg py-3 font-body text-body-md font-bold text-on-surface transition-colors hover:bg-surface-container"
              >
                <span className="material-symbols-outlined">launch</span>
                Open Colab notebook
              </a>
            </aside>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
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
}) {
  return (
    <div className="rounded-lg border border-outline-variant/20 bg-surface-container p-md">
      <dt className="font-label text-label uppercase tracking-widest text-on-surface-variant">
        {label}
      </dt>
      <dd
        className={`mt-xs font-h3 text-body-lg font-bold text-on-surface ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
