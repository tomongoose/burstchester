import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
} from "firebase/firestore";
import { getDb, getFirebaseAuth } from "@/lib/firebase";
import { buildInitialProfileDoc, type AuthUser } from "@/lib/users/seed";

export interface AuthServiceDeps {
  readonly auth: Auth;
  readonly db: Firestore;
  readonly clock: () => Date;
  readonly signInWithPopup: (
    auth: Auth,
    provider: GoogleAuthProvider,
  ) => Promise<{ user: FirebaseUser }>;
  readonly firebaseSignOut: (auth: Auth) => Promise<void>;
  readonly getDoc: (ref: DocumentReference) => Promise<DocumentSnapshot>;
  readonly setDoc: (ref: DocumentReference, data: unknown) => Promise<void>;
  readonly doc: (
    db: Firestore,
    collection: string,
    id: string,
  ) => DocumentReference;
  readonly createGoogleProvider: () => GoogleAuthProvider;
}

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  async signInWithGoogle(): Promise<void> {
    const provider = this.deps.createGoogleProvider();
    const result = await this.deps.signInWithPopup(this.deps.auth, provider);
    await this.ensureUserProfile(result.user);
  }

  async signOut(): Promise<void> {
    await this.deps.firebaseSignOut(this.deps.auth);
  }

  async ensureUserProfile(user: FirebaseUser): Promise<void> {
    if (!user.uid) {
      throw new Error("ensureUserProfile requires a user with a uid");
    }
    const ref = this.deps.doc(this.deps.db, "users", user.uid);
    const existing = await this.deps.getDoc(ref);
    if (existing.exists()) return;

    const authUser: AuthUser = {
      uid: user.uid,
      displayName: user.displayName ?? "",
      email: user.email ?? "",
      photoURL: user.photoURL,
    };
    const seed = buildInitialProfileDoc(authUser, this.deps.clock());
    await this.deps.setDoc(ref, seed);
  }
}

export function buildDefaultAuthService(): AuthService {
  return new AuthService({
    auth: getFirebaseAuth(),
    db: getDb(),
    clock: () => new Date(),
    signInWithPopup,
    firebaseSignOut,
    getDoc,
    setDoc,
    doc,
    createGoogleProvider: () => new GoogleAuthProvider(),
  });
}

let cachedDefault: AuthService | null = null;
export function getDefaultAuthService(): AuthService {
  if (!cachedDefault) cachedDefault = buildDefaultAuthService();
  return cachedDefault;
}

