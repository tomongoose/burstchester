import type { JSX } from "react";
import Link from "next/link";
import type { DatasetSummary } from "@/lib/domain/dataset-summary";
import { buildDatasetDetailHref } from "@/lib/datasets/routes";

const MAX_VISIBLE_TAGS = 3;

interface DatasetCardProps {
  readonly summary: DatasetSummary;
  readonly selected: boolean;
  readonly onToggleSelect: (datasetId: string) => void;
}

export function DatasetCard({
  summary,
  selected,
  onToggleSelect,
}: DatasetCardProps): JSX.Element {
  const visibleTags = summary.tags.slice(0, MAX_VISIBLE_TAGS);
  return (
    <article className="card-hover-glow group flex h-full flex-col overflow-hidden border border-white/10 bg-surface-container">
      <div className="relative h-24 overflow-hidden bg-gradient-to-br from-primary-container/10 via-surface-container-high to-surface-container">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(245,158,11,0.16),transparent_70%)]" />
        <span className="absolute bottom-2 left-md font-label text-label uppercase tracking-[0.22em] text-on-surface-variant">
          {summary.size.category}
        </span>
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`${selected ? "Remove" : "Add"} ${summary.title}`}
          onClick={() => onToggleSelect(summary.id)}
          className={[
            "absolute right-3 top-3 inline-flex items-center rounded-full border px-3 py-1 font-label text-[10px] uppercase tracking-[0.2em]",
            selected
              ? "border-primary bg-primary text-on-primary"
              : "border-white/20 bg-black/20 text-on-surface",
          ].join(" ")}
        >
          {selected ? "Selected" : "Add"}
        </button>
      </div>
      <Link
        href={buildDatasetDetailHref(summary.id)}
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
              className="rounded-full border border-primary/20 px-3 py-1 font-label text-[10px] uppercase tracking-[0.2em] text-primary"
            >
              {tag}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center justify-between border-t border-outline-variant/20 pt-md">
          <span className="font-label text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
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
