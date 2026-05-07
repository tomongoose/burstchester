import type { JSX } from "react";
import Link from "next/link";
import type { DatasetSummary } from "@/lib/domain/dataset-summary";

const MAX_VISIBLE_TAGS = 3;

interface DatasetCardProps {
  readonly summary: DatasetSummary;
}

export function DatasetCard({ summary }: DatasetCardProps): JSX.Element {
  const visibleTags = summary.tags.slice(0, MAX_VISIBLE_TAGS);
  return (
    <article className="card-hover-glow group flex h-full flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container">
      <div className="relative h-24 overflow-hidden bg-gradient-to-br from-primary-container/20 via-surface-container-high to-surface-container">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.18),transparent_70%)]" />
        <span className="absolute bottom-2 left-md font-label text-label uppercase tracking-widest text-on-surface-variant">
          {summary.size.category}
        </span>
      </div>
      <Link
        href={`/datasets/${summary.id}`}
        className="flex flex-1 flex-col gap-md p-lg focus-visible:outline-2 focus-visible:outline-primary"
      >
        <div className="flex items-start justify-between gap-sm">
          <h4 className="font-h3 text-body-lg font-bold text-on-surface group-hover:text-primary">
            {summary.title}
          </h4>
        </div>
        <p className="line-clamp-2 font-body text-body-md text-on-surface-variant">
          {summary.description || "No description provided."}
        </p>
        <ul aria-label="tags" className="flex flex-wrap gap-xs">
          {visibleTags.map((tag) => (
            <li
              key={tag}
              data-testid="tag-chip"
              className="rounded bg-surface-variant px-2 py-1 font-label text-label uppercase tracking-widest text-primary"
            >
              {tag}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center justify-between border-t border-outline-variant/20 pt-md">
          <span className="font-label text-label uppercase tracking-widest text-on-surface-variant">
            by {summary.ownerName}
          </span>
          <div className="flex items-center gap-md text-on-surface-variant">
            <span className="inline-flex items-center gap-xs font-label text-label">
              <span className="material-symbols-outlined text-base">favorite</span>
              {summary.likeCount}
            </span>
            <span className="inline-flex items-center gap-xs font-label text-label">
              <span className="material-symbols-outlined text-base">download</span>
              {summary.downloadCount}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
