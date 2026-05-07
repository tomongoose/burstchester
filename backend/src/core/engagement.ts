import { tryTransitionStatus, type DatasetStatus } from "./dataset-status";

export interface DatasetCounterState {
  readonly ownerUid: string;
  readonly likeCount?: number;
  readonly reportCount?: number;
  readonly downloadCount?: number;
  readonly status?: DatasetStatus;
}

export function applyLikeWrite(
  dataset: DatasetCounterState,
  beforeExists: boolean,
  afterExists: boolean,
) {
  const delta = existenceDelta(beforeExists, afterExists);
  return Object.freeze({
    dataset: Object.freeze({
      likeCount: Math.max(0, (dataset.likeCount ?? 0) + delta),
    }),
    owner: Object.freeze({
      uid: dataset.ownerUid,
      reputationDelta: delta,
    }),
  });
}

export function applyReportWrite(
  dataset: DatasetCounterState,
  beforeExists: boolean,
  afterExists: boolean,
) {
  const delta = existenceDelta(beforeExists, afterExists);
  const reportCount = Math.max(0, (dataset.reportCount ?? 0) + delta);
  const currentStatus: DatasetStatus = dataset.status ?? "active";
  const status = reportCount >= 3 ? tryTransitionStatus(currentStatus, "flagged") : currentStatus;
  return Object.freeze({
    dataset: Object.freeze({
      reportCount,
      status,
    }),
    owner: Object.freeze({
      uid: dataset.ownerUid,
      reputationDelta: delta * -5,
    }),
  });
}

export function applyDownloadStats(dataset: DatasetCounterState) {
  return Object.freeze({
    dataset: Object.freeze({
      downloadCount: (dataset.downloadCount ?? 0) + 1,
    }),
    owner: Object.freeze({
      uid: dataset.ownerUid,
      downloadCountDelta: 1,
    }),
  });
}

function existenceDelta(beforeExists: boolean, afterExists: boolean): number {
  if (beforeExists === afterExists) {
    return 0;
  }

  return afterExists ? 1 : -1;
}
