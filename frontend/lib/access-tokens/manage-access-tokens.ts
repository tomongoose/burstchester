import { resolveDatasetBackendBaseUrl } from "@/lib/datasets/list-datasets";
import type { AccessTokenUser } from "./issue-access-token";

export interface AccessTokenSummary {
  readonly id: string;
  readonly label: string;
  readonly createdAt: string;
  readonly lastUsedAt?: string;
}

interface ListAccessTokensResponse {
  readonly ok?: boolean;
  readonly tokens?: AccessTokenSummary[];
  readonly error?: string;
}

interface DeleteAccessTokenResponse {
  readonly ok?: boolean;
  readonly tokenId?: string;
  readonly error?: string;
}

export async function listAccessTokensForUser({
  user,
  endpointUrl = resolveListAccessTokensUrl(),
  fetchImpl = fetch,
}: {
  readonly user: AccessTokenUser;
  readonly endpointUrl?: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<AccessTokenSummary[]> {
  const idToken = await user.getIdToken();
  const response = await fetchImpl(endpointUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: "application/json",
    },
  });

  const payload = (await response.json()) as ListAccessTokensResponse;
  if (!response.ok || !payload.ok || !Array.isArray(payload.tokens)) {
    throw new Error(payload.error || `Access token listing failed with status ${response.status}.`);
  }
  return payload.tokens;
}

export async function deleteAccessTokenForUser({
  user,
  tokenId,
  endpointUrl = resolveRevokeAccessTokenUrl(),
  fetchImpl = fetch,
}: {
  readonly user: AccessTokenUser;
  readonly tokenId: string;
  readonly endpointUrl?: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<void> {
  const idToken = await user.getIdToken();
  const response = await fetchImpl(endpointUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ tokenId }),
  });

  const payload = (await response.json()) as DeleteAccessTokenResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Access token deletion failed with status ${response.status}.`);
  }
}

export function resolveListAccessTokensUrl(): string {
  return `${resolveDatasetBackendBaseUrl()}/listAccessTokens`;
}

export function resolveRevokeAccessTokenUrl(): string {
  return `${resolveDatasetBackendBaseUrl()}/revokeAccessToken`;
}
