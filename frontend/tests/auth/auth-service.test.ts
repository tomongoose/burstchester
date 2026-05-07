import { describe, it, expect } from "vitest";
import {
  GoogleAuthProvider,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";
import type { DocumentReference, Firestore } from "firebase/firestore";

import { AuthService, type AuthServiceDeps } from "@/lib/auth";

const FAKE_AUTH = {} as Auth;
const FAKE_DB = {} as Firestore;
const FIXED_NOW = new Date("2026-05-05T00:00:00Z");

class AuthAdapterSpy {
  signInWithPopupCalls: Array<{ auth: Auth; provider: GoogleAuthProvider }> = [];
  signOutCalls: Array<{ auth: Auth }> = [];
  popupResultUser: FirebaseUser = {
    uid: "u-1",
    displayName: "Test User",
    email: "test@example.com",
    photoURL: null,
  } as FirebaseUser;

  signInWithPopup = async (auth: Auth, provider: GoogleAuthProvider) => {
    this.signInWithPopupCalls.push({ auth, provider });
    return { user: this.popupResultUser };
  };

  firebaseSignOut = async (auth: Auth) => {
    this.signOutCalls.push({ auth });
  };
}

class FirestoreReaderStub {
  documents = new Map<string, unknown>();

  doc = (_db: Firestore, collection: string, id: string) => {
    return { __key: `${collection}/${id}` } as unknown as DocumentReference;
  };

  getDoc = async (ref: DocumentReference) => {
    const key = (ref as unknown as { __key: string }).__key;
    return {
      exists: () => this.documents.has(key),
      data: () => this.documents.get(key),
    } as { exists: () => boolean; data: () => unknown };
  };
}

class FirestoreWriterSpy {
  setDocCalls: Array<{ key: string; data: unknown }> = [];

  setDoc = async (ref: DocumentReference, data: unknown) => {
    const key = (ref as unknown as { __key: string }).__key;
    this.setDocCalls.push({ key, data });
  };
}

function createService(overrides: Partial<AuthServiceDeps> = {}) {
  const authAdapter = new AuthAdapterSpy();
  const firestoreReader = new FirestoreReaderStub();
  const firestoreWriter = new FirestoreWriterSpy();
  const provider = new GoogleAuthProvider();

  const deps: AuthServiceDeps = {
    auth: FAKE_AUTH,
    db: FAKE_DB,
    clock: () => FIXED_NOW,
    signInWithPopup: authAdapter.signInWithPopup,
    firebaseSignOut: authAdapter.firebaseSignOut,
    getDoc: firestoreReader.getDoc as AuthServiceDeps["getDoc"],
    setDoc: firestoreWriter.setDoc,
    doc: firestoreReader.doc,
    createGoogleProvider: () => provider,
    ...overrides,
  };

  const service = new AuthService(deps);
  return { service, authAdapter, firestoreReader, firestoreWriter, provider };
}

describe("AuthService.signInWithGoogle", () => {
  it("calls signInWithPopup with the injected auth and a GoogleAuthProvider", async () => {
    const { service, authAdapter, provider } = createService();

    await service.signInWithGoogle();

    expect(authAdapter.signInWithPopupCalls.length).toBe(1);
    expect(authAdapter.signInWithPopupCalls[0].auth).toBe(FAKE_AUTH);
    expect(authAdapter.signInWithPopupCalls[0].provider).toBe(provider);
  });

  it("ensures a user profile is seeded for a new user", async () => {
    const { service, authAdapter, firestoreWriter } = createService();
    authAdapter.popupResultUser = {
      uid: "new-user",
      displayName: "Newcomer",
      email: "new@example.com",
      photoURL: null,
    } as FirebaseUser;

    await service.signInWithGoogle();

    expect(firestoreWriter.setDocCalls.length).toBe(1);
    expect(firestoreWriter.setDocCalls[0].key).toBe("users/new-user");
    const seed = firestoreWriter.setDocCalls[0].data as {
      uid: string;
      displayName: string;
      email: string;
      uploadCount: number;
      createdAt: Date;
    };
    expect(seed.uid).toBe("new-user");
    expect(seed.displayName).toBe("Newcomer");
    expect(seed.email).toBe("new@example.com");
    expect(seed.uploadCount).toBe(0);
    expect(seed.createdAt).toBe(FIXED_NOW);
  });

  it("skips profile creation when the document already exists", async () => {
    const { service, authAdapter, firestoreReader, firestoreWriter } =
      createService();
    authAdapter.popupResultUser = {
      uid: "existing",
      displayName: "Existing",
      email: "existing@example.com",
      photoURL: null,
    } as FirebaseUser;
    firestoreReader.documents.set("users/existing", { uid: "existing" });

    await service.signInWithGoogle();

    expect(firestoreWriter.setDocCalls.length).toBe(0);
  });
});

describe("AuthService.signOut", () => {
  it("delegates to firebaseSignOut on the injected auth", async () => {
    const { service, authAdapter } = createService();

    await service.signOut();

    expect(authAdapter.signOutCalls.length).toBe(1);
    expect(authAdapter.signOutCalls[0].auth).toBe(FAKE_AUTH);
  });
});

describe("AuthService.ensureUserProfile", () => {
  it("rejects a user without a uid", async () => {
    const { service } = createService();
    const userWithoutUid = { uid: "" } as FirebaseUser;

    await expect(service.ensureUserProfile(userWithoutUid)).rejects.toThrow(
      /uid/i,
    );
  });
});
