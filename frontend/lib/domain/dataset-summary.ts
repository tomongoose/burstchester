import { DatasetSize } from "./dataset-size";

const MAX_DESCRIPTION_LENGTH = 500;

export interface DatasetRecordLike {
  readonly id: string;
  readonly ownerName: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly rowCount: number;
  readonly likeCount: number;
  readonly downloadCount: number;
  readonly status: string;
}

export interface DatasetSummary {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly ownerName: string;
  readonly tags: readonly string[];
  readonly likeCount: number;
  readonly downloadCount: number;
  readonly size: DatasetSize;
}

export function buildDatasetSummary(record: DatasetRecordLike): DatasetSummary {
  return Object.freeze({
    id: record.id,
    title: record.title,
    description: truncate(record.description, MAX_DESCRIPTION_LENGTH),
    ownerName: record.ownerName,
    tags: Object.freeze([...record.tags]),
    likeCount: Math.max(0, record.likeCount),
    downloadCount: Math.max(0, record.downloadCount),
    size: DatasetSize.fromRowCount(Math.max(0, record.rowCount)),
  });
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}
