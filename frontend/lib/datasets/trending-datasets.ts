import { buildDatasetSummary, type DatasetSummary } from "@/lib/domain/dataset-summary";
import { resolveDatasetBackendBaseUrl } from "./list-datasets";

interface TrendingDatasetRecord {
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

interface TrendingDatasetsResponse {
  readonly ok: boolean;
  readonly updatedAt: number;
  readonly datasets: readonly TrendingDatasetRecord[];
}

const trendingDatasetsCache = new Map<
  string,
  {
    readonly summaries: readonly DatasetSummary[];
    readonly expiresAt: number;
  }
>();

const TRENDING_DATASETS_CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchTrendingDatasetSummaries(
  fetchImpl: typeof fetch = fetch,
  baseUrl: string = `${resolveDatasetBackendBaseUrl()}/listTrendingDatasets`,
): Promise<readonly DatasetSummary[]> {
  const now = Date.now();
  const cached = trendingDatasetsCache.get(baseUrl);
  if (cached && cached.expiresAt > now) {
    return cached.summaries;
  }

  const response = await fetchImpl(baseUrl);
  if (!response.ok) {
    throw new Error(`Trending dataset listing failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as TrendingDatasetsResponse;
  const summaries = Object.freeze(
    payload.datasets.map((record) => buildDatasetSummary(record)),
  );

  trendingDatasetsCache.set(baseUrl, {
    summaries,
    expiresAt: now + TRENDING_DATASETS_CACHE_TTL_MS,
  });
  return summaries;
}
