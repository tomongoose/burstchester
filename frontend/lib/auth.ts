import {
  getRedirectResult,
  GoogleAuthProvider,
  linkWithRedirect,
  signInWithCredential,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type AuthCredential,
  type Auth,
  type User as FirebaseAuthUser,
  type User as FirebaseUser,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { resolveDatasetBackendBaseUrl } from "@/lib/datasets/list-datasets";

export interface AuthServiceDeps {
  readonly auth: Auth;
  readonly clock: () => Date;
  readonly signInWithRedirect: (
    auth: Auth,
    provider: GoogleAuthProvider,
  ) => Promise<void>;
  readonly linkWithRedirect: (
    user: FirebaseAuthUser,
    provider: GoogleAuthProvider,
  ) => Promise<void>;
  readonly getRedirectResult: (
    auth: Auth,
  ) => Promise<{ user: FirebaseUser } | null>;
  readonly signInWithCredential: (
    auth: Auth,
    credential: AuthCredential,
  ) => Promise<{ user: FirebaseUser }>;
  readonly firebaseSignOut: (auth: Auth) => Promise<void>;
  readonly credentialFromRedirectError: (error: unknown) => AuthCredential | null;
  readonly createGoogleProvider: () => GoogleAuthProvider;
  readonly upsertProfile: (user: FirebaseUser) => Promise<void>;
}

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  async signInWithGoogle(): Promise<void> {
    const provider = this.deps.createGoogleProvider();
    const currentUser = this.deps.auth.currentUser;
    if (currentUser?.isAnonymous) {
      try {
        await this.deps.linkWithRedirect(currentUser, provider);
      } catch (error) {
        if (!isCredentialAlreadyInUseError(error)) throw error;
        await this.deps.firebaseSignOut(this.deps.auth);
        await this.deps.signInWithRedirect(this.deps.auth, provider);
      }
      return;
    }

    await this.deps.signInWithRedirect(this.deps.auth, provider);
  }

  async handleGoogleRedirectResult(): Promise<boolean> {
    const result = await this.readGoogleRedirectResult();
    if (!result?.user) return false;
    await this.ensureUserProfile(result.user);
    return true;
  }

  async signOut(): Promise<void> {
    await this.deps.firebaseSignOut(this.deps.auth);
  }

  async ensureUserProfile(user: FirebaseUser): Promise<void> {
    if (!user.uid) {
      throw new Error("ensureUserProfile requires a user with a uid");
    }
    await this.deps.upsertProfile(user);
  }

  private async readGoogleRedirectResult(): Promise<{ user: FirebaseUser } | null> {
    try {
      return await this.deps.getRedirectResult(this.deps.auth);
    } catch (error) {
      if (!isCredentialAlreadyInUseError(error)) throw error;

      const credential = this.deps.credentialFromRedirectError(error);
      await this.deps.firebaseSignOut(this.deps.auth);
      if (!credential) {
        await this.deps.signInWithRedirect(
          this.deps.auth,
          this.deps.createGoogleProvider(),
        );
        return null;
      }

      return this.deps.signInWithCredential(this.deps.auth, credential);
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

export function buildDefaultAuthService(): AuthService {
  return new AuthService({
    auth: getFirebaseAuth(),
    clock: () => new Date(),
    signInWithRedirect,
    linkWithRedirect,
    getRedirectResult,
    signInWithCredential,
    firebaseSignOut,
    credentialFromRedirectError: (error) => GoogleAuthProvider.credentialFromError(error as never),
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
