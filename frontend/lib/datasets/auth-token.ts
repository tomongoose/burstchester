import { resolveFirebaseWebConfig } from "@/lib/firebase";

interface AnonymousSignInResponse {
  readonly idToken: string;
  readonly expiresIn: string;
}

interface CachedToken {
  readonly token: string;
  readonly expiresAt: number;
}

let inFlightToken: Promise<string> | null = null;
let cachedToken: CachedToken | null = null;

export async function getDatasetApiAuthToken(
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }

  if (!inFlightToken) {
    inFlightToken = fetchAnonymousIdToken(fetchImpl).finally(() => {
      inFlightToken = null;
    });
  }

  return inFlightToken;
}

export async function fetchAnonymousIdToken(
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const { apiKey } = resolveFirebaseWebConfig();
  const response = await fetchImpl(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        returnSecureToken: true,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Anonymous sign-in failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as AnonymousSignInResponse;
  const expiresInMs = Number(payload.expiresIn || "0") * 1000;
  cachedToken = {
    token: payload.idToken,
    expiresAt: Date.now() + expiresInMs,
  };
  return payload.idToken;
}

export function __resetDatasetApiAuthTokenCacheForTests(): void {
  inFlightToken = null;
  cachedToken = null;
}
