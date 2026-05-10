import { signInAnonymously as firebaseSignInAnonymously, type Auth } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import type { AccessTokenUser } from "./issue-access-token";

interface AccessTokenAuth {
  readonly currentUser: AccessTokenUser | null;
}

interface GetOrCreateAccessTokenUserInput {
  readonly auth?: AccessTokenAuth;
  readonly signInAnonymously?: (
    auth: AccessTokenAuth,
  ) => Promise<{ user: AccessTokenUser }>;
}

export async function getOrCreateAccessTokenUser({
  auth = getFirebaseAuth() as Auth & AccessTokenAuth,
  signInAnonymously = (targetAuth) =>
    firebaseSignInAnonymously(targetAuth as Auth),
}: GetOrCreateAccessTokenUserInput = {}): Promise<AccessTokenUser> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  const credential = await signInAnonymously(auth);
  return credential.user;
}
