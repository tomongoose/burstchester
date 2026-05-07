"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDb, getFirebaseFunctions } from "@/lib/firebase";
import { buildDatasetSummary, type DatasetSummary } from "@/lib/domain/dataset-summary";
import { buildDatasetJsonLd } from "@/lib/datasets/seo";
import { DownloadButton } from "@/components/datasets/DownloadButton";
import type { PrepareDownloadResponse } from "@/lib/datasets/download";
import { useParams } from "next/navigation";

export default function DatasetDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const [summary, setSummary] = useState<DatasetSummary | null>(null);

  useEffect(() => {
    if (!id) return;
    const ref = doc(getDb(), "datasets", id);
    return onSnapshot(ref, (snap) => {
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

  if (!summary) return <main>Loading…</main>;

  const ld = buildDatasetJsonLd(summary);

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <h1>{summary.title}</h1>
      <p>by {summary.ownerName}</p>
      <p>{summary.description}</p>
      <p>
        {summary.likeCount} likes · {summary.downloadCount} downloads ({summary.size.category})
      </p>
      <ul aria-label="tags">
        {summary.tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <DownloadButton
        datasetId={summary.id}
        callable={callable}
        navigate={(url) => window.location.assign(url)}
      />
    </main>
  );
}
