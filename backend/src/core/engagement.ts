export interface DatasetCounterState {
  ownerUid: string;
  likeCount?: number;
  reportCount?: number;
  downloadCount?: number;
  status?: string;
}

export function applyLikeWrite(
  dataset: DatasetCounterState,
  beforeExists: boolean,
  afterExists: boolean,
) {
  const delta = existenceDelta(beforeExists, afterExists);
  return {
    dataset: {
      likeCount: Math.max(0, (dataset.likeCount ?? 0) + delta),
    },
    owner: {
      uid: dataset.ownerUid,
      reputationDelta: delta,
    },
  };
}

export function applyReportWrite(
  dataset: DatasetCounterState,
  beforeExists: boolean,
  afterExists: boolean,
) {
  const delta = existenceDelta(beforeExists, afterExists);
  const reportCount = Math.max(0, (dataset.reportCount ?? 0) + delta);
  return {
    dataset: {
      reportCount,
      status: reportCount >= 3 ? "flagged" : dataset.status ?? "active",
    },
    owner: {
      uid: dataset.ownerUid,
      reputationDelta: delta * -5,
    },
  };
}

export function applyDownloadStats(dataset: DatasetCounterState) {
  return {
    dataset: {
      downloadCount: (dataset.downloadCount ?? 0) + 1,
    },
    owner: {
      uid: dataset.ownerUid,
      downloadCountDelta: 1,
    },
  };
}

function existenceDelta(beforeExists: boolean, afterExists: boolean): number {
  if (beforeExists === afterExists) {
    return 0;
  }

  return afterExists ? 1 : -1;
}
