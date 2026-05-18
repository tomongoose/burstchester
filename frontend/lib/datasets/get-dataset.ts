import { buildDatasetSummary, type DatasetSummary } from "@/lib/domain/dataset-summary";
import { resolveDatasetBackendBaseUrl } from "./list-datasets";
import { getDatasetApiAuthToken } from "./auth-token";

interface DatasetRecordLike {
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
  readonly previewSamples?: readonly {
    readonly messages: readonly {
      readonly role: string;
      readonly content: string;
    }[];
  }[];
}

interface GetDatasetResponse {
  readonly ok: boolean;
  readonly dataset: DatasetRecordLike;
}

const SUCCESS_CACHE_TTL_MS = 10_000;
const FAILURE_BACKOFF_MS = 15_000;
const FAILURE_BACKOFF_STORAGE_PREFIX = "burstchester:get-dataset:failed:";

const datasetDetailCache = new Map<
  string,
  {
    readonly summary: DatasetSummary | null;
    readonly expiresAt: number;
    readonly failedAt: number | null;
  }
>();
const datasetDetailInflight = new Map<string, Promise<DatasetSummary | null>>();

export async function fetchDatasetSummaryById(
  datasetId: string,
  fetchImpl: typeof fetch = fetch,
  baseUrl: string = `${resolveDatasetBackendBaseUrl()}/getDataset`,
): Promise<DatasetSummary | null> {
  const url = new URL(baseUrl);
  url.searchParams.set("datasetId", datasetId);
  const key = url.toString();
  const now = Date.now();
  const cached = datasetDetailCache.get(key);
  const persistedFailedAt = readFailureBackoffTimestamp(key);

  if (cached && cached.expiresAt > now) {
    return cached.summary;
  }

  if (persistedFailedAt && now - persistedFailedAt < FAILURE_BACKOFF_MS) {
    return cached?.summary ?? null;
  }

  if (cached?.failedAt && now - cached.failedAt < FAILURE_BACKOFF_MS) {
    return cached.summary;
  }

  const inFlight = datasetDetailInflight.get(key);
  if (inFlight) {
    return inFlight;
  }

  const request = (async (): Promise<DatasetSummary | null> => {
    try {
      const token = await getDatasetApiAuthToken();
      const response = await fetchImpl(key, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.status === 404) {
        clearFailureBackoffTimestamp(key);
        datasetDetailCache.set(key, {
          summary: null,
          expiresAt: Date.now() + SUCCESS_CACHE_TTL_MS,
          failedAt: null,
        });
        return null;
      }
      if (!response.ok) {
        throw new Error(`Dataset detail failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as GetDatasetResponse;
      const summary = buildDatasetSummary(payload.dataset);
      clearFailureBackoffTimestamp(key);
      datasetDetailCache.set(key, {
        summary,
        expiresAt: Date.now() + SUCCESS_CACHE_TTL_MS,
        failedAt: null,
      });
      return summary;
    } catch {
      const fallback = cached?.summary ?? null;
      writeFailureBackoffTimestamp(key, Date.now());
      datasetDetailCache.set(key, {
        summary: fallback,
        expiresAt: Date.now() + FAILURE_BACKOFF_MS,
        failedAt: Date.now(),
      });
      return fallback;
    } finally {
      datasetDetailInflight.delete(key);
    }
  })();

  datasetDetailInflight.set(key, request);
  return request;
}

export function __resetDatasetDetailRequestCacheForTests(): void {
  datasetDetailCache.clear();
  datasetDetailInflight.clear();
  clearFailureBackoffStorage();
}

function readFailureBackoffTimestamp(key: string): number | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(
      `${FAILURE_BACKOFF_STORAGE_PREFIX}${key}`,
    );
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeFailureBackoffTimestamp(key: string, value: number): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      `${FAILURE_BACKOFF_STORAGE_PREFIX}${key}`,
      String(value),
    );
  } catch {}
}

function clearFailureBackoffTimestamp(key: string): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(`${FAILURE_BACKOFF_STORAGE_PREFIX}${key}`);
  } catch {}
}

function clearFailureBackoffStorage(): void {
  if (typeof window === "undefined") return;

  try {
    const keys: string[] = [];
    for (let idx = 0; idx < window.sessionStorage.length; idx += 1) {
      const key = window.sessionStorage.key(idx);
      if (key?.startsWith(FAILURE_BACKOFF_STORAGE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {}
}
