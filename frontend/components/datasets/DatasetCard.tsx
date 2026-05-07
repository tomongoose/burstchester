import type { JSX } from "react";
import type { DatasetSummary } from "@/lib/domain/dataset-summary";

const MAX_VISIBLE_TAGS = 5;

interface DatasetCardProps {
  readonly summary: DatasetSummary;
}

export function DatasetCard({ summary }: DatasetCardProps): JSX.Element {
  const visibleTags = summary.tags.slice(0, MAX_VISIBLE_TAGS);
  return (
    <article>
      <h3>{summary.title}</h3>
      <p>by {summary.ownerName}</p>
      <p>{summary.size.category}</p>
      <ul aria-label="tags">
        {visibleTags.map((tag) => (
          <li key={tag} data-testid="tag-chip">
            {tag}
          </li>
        ))}
      </ul>
      <p>
        {summary.likeCount} likes · {summary.downloadCount} downloads
      </p>
    </article>
  );
}
