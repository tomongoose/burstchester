import { buildDatasetSummary, type DatasetSummary } from "@/lib/domain/dataset-summary";
import type { SearchFilter } from "@/lib/domain/search-filter";
import type { SortOrder } from "./build-query";

interface DatasetSearchOptions {
  readonly filter: SearchFilter;
  readonly sort: SortOrder;
}

interface DatasetSummaryRecord {
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

interface ListDatasetsResponse {
  readonly ok: boolean;
  readonly datasets: readonly DatasetSummaryRecord[];
}

export async function fetchDatasetSummaries(
  options: DatasetSearchOptions,
  fetchImpl: typeof fetch = fetch,
  baseUrl: string = `${resolveDatasetBackendBaseUrl()}/listDatasets`,
): Promise<readonly DatasetSummary[]> {
  const url = new URL(baseUrl);
  appendQuery(url.searchParams, options);

  const response = await fetchImpl(url.toString());
  if (!response.ok) {
    throw new Error(`Dataset listing failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as ListDatasetsResponse;
  return Object.freeze(
    payload.datasets.map((record) => buildDatasetSummary(record)),
  );
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
    const hostname = window.location.hostname;
    if (hostname.endsWith(".web.app") || hostname.endsWith(".firebaseapp.com")) {
      const [candidate] = hostname.split(".");
      if (candidate) return candidate;
    }
  }

  return "";
}
