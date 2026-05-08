import { buildDatasetSummary, type DatasetSummary } from "@/lib/domain/dataset-summary";
import type { SearchFilter } from "@/lib/domain/search-filter";
import { resolveFirebaseWebConfig } from "@/lib/firebase";
import type { SortOrder } from "./build-query";
import { getDatasetApiAuthToken } from "./auth-token";

interface DatasetSearchOptions {
  readonly filter: SearchFilter;
  readonly sort: SortOrder;
}

interface DatasetSummaryRecord {
  readonly id: string;
  readonly ownerUid: string;
  readonly ownerName: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly rowCount: number;
  readonly likeCount: number;
  readonly downloadCount: number;
  readonly status: string;
}

interface ListDatasetsResponse {
  readonly ok: boolean;
  readonly datasets: readonly DatasetSummaryRecord[];
}

const SUCCESS_CACHE_TTL_MS = 10_000;
const FAILURE_BACKOFF_MS = 15_000;
const EMPTY_DATASET_SUMMARIES = Object.freeze([]) as readonly DatasetSummary[];
const FAILURE_BACKOFF_STORAGE_PREFIX = "burstchester:list-datasets:failed:";

const datasetSummaryCache = new Map<
  string,
  {
    readonly summaries: readonly DatasetSummary[];
    readonly expiresAt: number;
    readonly failedAt: number | null;
  }
>();
const datasetSummaryInflight = new Map<
  string,
  Promise<readonly DatasetSummary[]>
>();

export async function fetchDatasetSummaries(
  options: DatasetSearchOptions,
  fetchImpl: typeof fetch = fetch,
  baseUrl: string = `${resolveDatasetBackendBaseUrl()}/listDatasets`,
): Promise<readonly DatasetSummary[]> {
  const url = new URL(baseUrl);
  appendQuery(url.searchParams, options);
  const key = url.toString();
  const now = Date.now();
  const cached = datasetSummaryCache.get(key);
  const persistedFailedAt = readFailureBackoffTimestamp(key);

  if (cached && cached.expiresAt > now) {
    return cached.summaries;
  }

  if (cached && persistedFailedAt && now - persistedFailedAt < FAILURE_BACKOFF_MS) {
    return cached?.summaries ?? EMPTY_DATASET_SUMMARIES;
  }

  if (cached?.failedAt && now - cached.failedAt < FAILURE_BACKOFF_MS) {
    return cached.summaries;
  }

  const inFlight = datasetSummaryInflight.get(key);
  if (inFlight) {
    return inFlight;
  }

  const request = (async (): Promise<readonly DatasetSummary[]> => {
    try {
      const token = await getDatasetApiAuthToken();
      const response = await fetchImpl(key, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Dataset listing failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as ListDatasetsResponse;
      const summaries = Object.freeze(
        payload.datasets.map((record) => buildDatasetSummary(record)),
      );
      clearFailureBackoffTimestamp(key);
      datasetSummaryCache.set(key, {
        summaries,
        expiresAt: Date.now() + SUCCESS_CACHE_TTL_MS,
        failedAt: null,
      });
      return summaries;
    } catch {
      const fallback = cached?.summaries ?? EMPTY_DATASET_SUMMARIES;
      writeFailureBackoffTimestamp(key, Date.now());
      datasetSummaryCache.set(key, {
        summaries: fallback,
        expiresAt: Date.now() + FAILURE_BACKOFF_MS,
        failedAt: Date.now(),
      });
      return fallback;
    } finally {
      datasetSummaryInflight.delete(key);
    }
  })();

  datasetSummaryInflight.set(key, request);
  return request;
}

export function resolveListDatasetsUrl(): string {
  return `${resolveDatasetBackendBaseUrl()}/listDatasets`;
}

export function resolveDatasetBackendBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_LIST_DATASETS_URL?.trim();
  if (explicit) {
    try {
      const url = new URL(explicit);
      const pathname = url.pathname.replace(/\/listDatasets$/, "");
      return `${url.origin}${pathname}`;
    } catch {
      return explicit.replace(/\/listDatasets$/, "");
    }
  }

  const projectId = resolveFirebaseProjectId();
  const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "1";

  if (useEmulator && projectId) {
    return `http://127.0.0.1:5001/${projectId}/us-central1`;
  }

  if (projectId) {
    return `https://us-central1-${projectId}.cloudfunctions.net`;
  }

  throw new Error("Missing NEXT_PUBLIC_LIST_DATASETS_URL or NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
}

function appendQuery(
  params: URLSearchParams,
  options: DatasetSearchOptions,
): void {
  if (options.filter.language) params.set("language", options.filter.language);
  if (options.filter.task) params.set("task", options.filter.task);
  if (options.filter.baseModel) params.set("baseModel", options.filter.baseModel);
  if (options.filter.tags.length > 0) params.set("tags", options.filter.tags.join(","));
  params.set("sort", options.sort);
  params.set("limit", "24");
}

function resolveFirebaseProjectId(): string {
  const explicit = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (explicit) return explicit;

  if (typeof window !== "undefined") {
    const inferred = inferFirebaseProjectIdFromHostname(window.location.hostname);
    if (inferred) return inferred;
  }

  return resolveFirebaseWebConfig().projectId;
}

export function inferFirebaseProjectIdFromHostname(hostname: string): string {
  if (hostname.endsWith(".web.app") || hostname.endsWith(".firebaseapp.com")) {
    const [candidate] = hostname.split(".");
    if (candidate) return candidate;
  }

  return "";
}

export function __resetDatasetSummaryRequestCacheForTests(): void {
  datasetSummaryCache.clear();
  datasetSummaryInflight.clear();
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
