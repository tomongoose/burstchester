import { getDatasetApiAuthToken } from "@/lib/datasets/auth-token";
import { resolveDatasetBackendBaseUrl } from "@/lib/datasets/list-datasets";
import {
  buildModelSummary,
  type ModelRecordLike,
  type ModelSummary,
} from "@/lib/domain/model-summary";

interface ModelSearchOptions {
  readonly sort: "newest";
  readonly ownerUid?: string;
}

interface ListModelsResponse {
  readonly ok: boolean;
  readonly models: readonly ModelRecordLike[];
}

export async function fetchModelSummaries(
  options: ModelSearchOptions,
  fetchImpl: typeof fetch = fetch,
  baseUrl: string = `${resolveDatasetBackendBaseUrl()}/listModels`,
): Promise<readonly ModelSummary[]> {
  const url = new URL(baseUrl);
  url.searchParams.set("sort", options.sort);
  if (options.ownerUid) url.searchParams.set("ownerUid", options.ownerUid);
  url.searchParams.set("limit", "24");

  const token = await getDatasetApiAuthToken();
  const response = await fetchImpl(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Model listing failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as ListModelsResponse;
  return Object.freeze(payload.models.map((record) => buildModelSummary(record)));
}
