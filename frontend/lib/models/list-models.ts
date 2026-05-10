import { getDatasetApiAuthToken } from "@/lib/datasets/auth-token";
import { resolveDatasetBackendBaseUrl } from "@/lib/datasets/list-datasets";
import {
  buildModelSummary,
  type ModelRecordLike,
  type ModelSummary,
} from "@/lib/domain/model-summary";
import type { SortOrder } from "@/lib/datasets/build-query";
import type { ModelSearchFilter } from "./model-filter";

interface ModelSearchOptions {
  readonly sort: SortOrder;
  readonly ownerUid?: string;
  readonly filter?: ModelSearchFilter;
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
  if (options.filter?.baseModel) {
    url.searchParams.set("baseModel", options.filter.baseModel);
  }
  if (options.filter?.trainingMethod) {
    url.searchParams.set("trainingMethod", options.filter.trainingMethod);
  }
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
