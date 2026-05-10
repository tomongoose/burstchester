import {
  GoogleAuthProvider,
  linkWithPopup,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User as FirebaseUser,
  type UserCredential,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { resolveDatasetBackendBaseUrl } from "@/lib/datasets/list-datasets";
import {
  clearCachedAuthUser,
  writeCachedAuthUser,
} from "@/lib/auth/auth-cache";

export interface AuthServiceDeps {
  readonly auth: Auth;
  readonly clock: () => Date;
  readonly signInWithPopup: (
    auth: Auth,
    provider: GoogleAuthProvider,
  ) => Promise<UserCredential>;
  readonly linkWithPopup: (
    user: FirebaseUser,
    provider: GoogleAuthProvider,
  ) => Promise<UserCredential>;
  readonly firebaseSignOut: (auth: Auth) => Promise<void>;
  readonly credentialFromError: (error: unknown) => GoogleAuthProvider | null;
  readonly createGoogleProvider: () => GoogleAuthProvider;
  readonly upsertProfile: (user: FirebaseUser) => Promise<void>;
}

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  async signInWithGoogle(): Promise<FirebaseUser | null> {
    const provider = this.deps.createGoogleProvider();
    const currentUser = this.deps.auth.currentUser;

    const credential = currentUser?.isAnonymous
      ? await this.linkAnonymousWithGoogle(currentUser, provider)
      : await this.deps.signInWithPopup(this.deps.auth, provider);

    const user = credential.user;
    await this.ensureUserProfile(user);
    writeCachedAuthUser({
      uid: user.uid,
      displayName: user.displayName ?? "",
      photoURL: user.photoURL ?? "",
    });
    return user;
  }

  async signOut(): Promise<void> {
    clearCachedAuthUser();
    await this.deps.firebaseSignOut(this.deps.auth);
  }

  async ensureUserProfile(user: FirebaseUser): Promise<void> {
    if (!user.uid) {
      throw new Error("ensureUserProfile requires a user with a uid");
    }
    await this.deps.upsertProfile(user);
  }

  private async linkAnonymousWithGoogle(
    currentUser: FirebaseUser,
    provider: GoogleAuthProvider,
  ): Promise<UserCredential> {
    try {
      return await this.deps.linkWithPopup(currentUser, provider);
    } catch (error) {
      if (!isCredentialAlreadyInUseError(error)) throw error;
      await this.deps.firebaseSignOut(this.deps.auth);
      return this.deps.signInWithPopup(this.deps.auth, provider);
    }
  }
}

function isCredentialAlreadyInUseError(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: unknown }).code === "auth/credential-already-in-use",
  );
}

export function isUserCancelledPopupError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return (
    code === "auth/popup-closed-by-user"
    || code === "auth/cancelled-popup-request"
    || code === "auth/user-cancelled"
  );
}

export function buildDefaultAuthService(): AuthService {
  return new AuthService({
    auth: getFirebaseAuth(),
    clock: () => new Date(),
    signInWithPopup,
    linkWithPopup,
    firebaseSignOut,
    credentialFromError: (error) => GoogleAuthProvider.credentialFromError(error as never) as unknown as GoogleAuthProvider | null,
    createGoogleProvider: () => new GoogleAuthProvider(),
    upsertProfile: upsertProfileThroughBackend,
  });
}

let cachedDefault: AuthService | null = null;
export function getDefaultAuthService(): AuthService {
  if (!cachedDefault) cachedDefault = buildDefaultAuthService();
  return cachedDefault;
}

export async function upsertProfileThroughBackend(user: FirebaseUser): Promise<void> {
  const idToken = await user.getIdToken();
  const response = await fetch(`${resolveDatasetBackendBaseUrl()}/upsertCliProfile`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      displayName: user.displayName || "Anonymous",
      photoURL: user.photoURL || "",
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `Profile upsert failed with status ${response.status}.`);
  }
}
