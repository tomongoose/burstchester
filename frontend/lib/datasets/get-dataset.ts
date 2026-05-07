import { buildDatasetSummary, type DatasetSummary } from "@/lib/domain/dataset-summary";
import { resolveDatasetBackendBaseUrl } from "./list-datasets";

interface DatasetRecordLike {
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

interface GetDatasetResponse {
  readonly ok: boolean;
  readonly dataset: DatasetRecordLike;
}

export async function fetchDatasetSummaryById(
  datasetId: string,
  fetchImpl: typeof fetch = fetch,
  baseUrl: string = `${resolveDatasetBackendBaseUrl()}/getDataset`,
): Promise<DatasetSummary | null> {
  const url = new URL(baseUrl);
  url.searchParams.set("datasetId", datasetId);

  const response = await fetchImpl(url.toString());
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Dataset detail failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as GetDatasetResponse;
  return buildDatasetSummary(payload.dataset);
}
