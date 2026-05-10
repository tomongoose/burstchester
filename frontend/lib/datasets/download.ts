export interface PrepareDownloadResponse {
  readonly cached: boolean;
  readonly zipPath: string;
  readonly url: string;
  readonly pointCost?: number;
  readonly remainingPoints?: number;
}

export interface CallPrepareDownloadDeps {
  readonly callable: (data: { datasetId: string }) => Promise<{ data: PrepareDownloadResponse }>;
}

export async function callPrepareDownload(
  deps: CallPrepareDownloadDeps,
  datasetId: string,
): Promise<PrepareDownloadResponse> {
  const result = await deps.callable({ datasetId });
  return result.data;
}

export interface TriggerBrowserDownloadDeps {
  readonly navigate: (url: string) => void;
}

export function triggerBrowserDownload(
  url: string,
  deps: TriggerBrowserDownloadDeps,
): void {
  if (!url) {
    throw new Error("Cannot trigger download with empty URL");
  }
  deps.navigate(url);
}
