import type { UserAccessTokenRecord } from "../core/access-tokens";
import { verifyUserAccessToken } from "../core/access-tokens";
import type { DecodedIdToken, HandlerDeps } from "./deps";

export async function verifyBearerAuth(
  deps: Pick<HandlerDeps, "auth" | "db" | "fieldValue">,
  bearerToken: string,
): Promise<DecodedIdToken> {
  if (bearerToken.startsWith("bst_")) {
    const decoded = await verifyUserAccessToken(bearerToken, async (uid, tokenId) => {
      const snapshot = await deps.db
        .doc(`users/${uid}/accessTokens/${tokenId}`)
        .get();
      return snapshot.exists ? (snapshot.data() as UserAccessTokenRecord) : null;
    });
    await deps.db
      .doc(`users/${decoded.uid}/accessTokens/${decoded.tokenId}`)
      .set(
        {
          lastUsedAt: deps.fieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    return { uid: decoded.uid };
  }

  return deps.auth.verifyIdToken(bearerToken);
}
