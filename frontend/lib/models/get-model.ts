import { getDatasetApiAuthToken } from "@/lib/datasets/auth-token";
import { resolveDatasetBackendBaseUrl } from "@/lib/datasets/list-datasets";
import {
  buildModelSummary,
  type ModelRecordLike,
  type ModelSummary,
} from "@/lib/domain/model-summary";

interface GetModelResponse {
  readonly ok: boolean;
  readonly model?: ModelRecordLike;
}

export async function fetchModelSummaryById(
  modelId: string,
  fetchImpl: typeof fetch = fetch,
  baseUrl: string = `${resolveDatasetBackendBaseUrl()}/getModel`,
): Promise<ModelSummary | null> {
  const url = new URL(baseUrl);
  url.searchParams.set("modelId", modelId);

  const token = await getDatasetApiAuthToken();
  const response = await fetchImpl(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Model detail failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as GetModelResponse;
  return payload.model ? buildModelSummary(payload.model) : null;
}
