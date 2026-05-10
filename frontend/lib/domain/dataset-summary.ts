import { DatasetSize } from "./dataset-size";

const MAX_DESCRIPTION_LENGTH = 500;

export interface DatasetRecordLike {
  readonly id: string;
  readonly ownerUid: string;
  readonly ownerName: string;
  readonly ownerPhotoURL?: string | null;
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
  readonly ownerUid: string;
  readonly ownerName: string;
  readonly ownerLabel: string;
  readonly ownerPhotoURL: string | null;
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
    ownerUid: record.ownerUid,
    ownerName: record.ownerName,
    ownerLabel: buildOwnerLabel(record.ownerUid, record.ownerName),
    ownerPhotoURL: normalizePhotoURL(record.ownerPhotoURL),
    tags: Object.freeze([...record.tags]),
    likeCount: Math.max(0, record.likeCount),
    downloadCount: Math.max(0, record.downloadCount),
    size: DatasetSize.fromRowCount(Math.max(0, record.rowCount)),
  });
}

function normalizePhotoURL(value?: string | null): string | null {
  const photoURL = value?.trim() ?? "";
  return photoURL.startsWith("https://") ? photoURL : null;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}

function buildOwnerLabel(ownerUid: string, ownerName: string): string {
  const trimmedName = ownerName.trim();
  if (!trimmedName) return "Anonymous";

  if (trimmedName === ownerUid || looksLikeOpaqueUid(trimmedName)) {
    return "Anonymous";
  }

  return trimmedName;
}

function looksLikeOpaqueUid(value: string): boolean {
  return /^[A-Za-z0-9_-]{20,}$/.test(value);
}
