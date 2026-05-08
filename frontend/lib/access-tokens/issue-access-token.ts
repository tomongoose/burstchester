import { resolveDatasetBackendBaseUrl } from "@/lib/datasets/list-datasets";

export interface AccessTokenUser {
  readonly getIdToken: () => Promise<string>;
}

export interface IssuedAccessToken {
  readonly token: string;
  readonly tokenId: string;
}

interface IssueAccessTokenInput {
  readonly user: AccessTokenUser;
  readonly label: string;
  readonly endpointUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

interface IssueAccessTokenResponse {
  readonly ok?: boolean;
  readonly token?: string;
  readonly tokenId?: string;
  readonly error?: string;
}

export async function issueAccessTokenForUser({
  user,
  label,
  endpointUrl = resolveIssueAccessTokenUrl(),
  fetchImpl = fetch,
}: IssueAccessTokenInput): Promise<IssuedAccessToken> {
  const idToken = await user.getIdToken();
  const response = await fetchImpl(endpointUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ label }),
  });

  const payload = (await response.json()) as IssueAccessTokenResponse;
  if (!response.ok || !payload.ok || !payload.token || !payload.tokenId) {
    throw new Error(payload.error || `Access token issue failed with status ${response.status}.`);
  }

  return {
    token: payload.token,
    tokenId: payload.tokenId,
  };
}

export function resolveIssueAccessTokenUrl(): string {
  return `${resolveDatasetBackendBaseUrl()}/issueAccessToken`;
}
