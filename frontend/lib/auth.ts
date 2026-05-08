import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type Auth,
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
  readonly getRedirectResult: (
    auth: Auth,
  ) => Promise<{ user: FirebaseUser } | null>;
  readonly firebaseSignOut: (auth: Auth) => Promise<void>;
  readonly createGoogleProvider: () => GoogleAuthProvider;
  readonly upsertProfile: (user: FirebaseUser) => Promise<void>;
}

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  async signInWithGoogle(): Promise<void> {
    const provider = this.deps.createGoogleProvider();
    await this.deps.signInWithRedirect(this.deps.auth, provider);
  }

  async handleGoogleRedirectResult(): Promise<boolean> {
    const result = await this.deps.getRedirectResult(this.deps.auth);
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
}

export function buildDefaultAuthService(): AuthService {
  return new AuthService({
    auth: getFirebaseAuth(),
    clock: () => new Date(),
    signInWithRedirect,
    getRedirectResult,
    firebaseSignOut,
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
