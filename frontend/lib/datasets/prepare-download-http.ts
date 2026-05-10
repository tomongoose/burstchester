import type { PrepareDownloadResponse } from "./download";
import { getDatasetApiAuthToken } from "./auth-token";

export async function requestPrepareDownloadHttp(
  datasetId: string,
  fetchImpl: typeof fetch = fetch,
  baseUrl: string,
): Promise<PrepareDownloadResponse> {
  const url = new URL(baseUrl);
  url.searchParams.set("datasetId", datasetId);
  const idToken = await getDatasetApiAuthToken(fetchImpl);

  const response = await fetchImpl(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Dataset download preparation failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as
    & { ok: boolean; datasetId: string }
    & PrepareDownloadResponse;

  return {
    cached: payload.cached,
    zipPath: payload.zipPath,
    url: payload.url,
    pointCost: payload.pointCost,
    remainingPoints: payload.remainingPoints,
  };
}
