import { describe, it, expect } from "vitest";
import {
  GoogleAuthProvider,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";

import { AuthService, type AuthServiceDeps } from "@/lib/auth";

const FAKE_AUTH = {} as Auth;
const FIXED_NOW = new Date("2026-05-05T00:00:00Z");

class AuthAdapterSpy {
  signInWithRedirectCalls: Array<{ auth: Auth; provider: GoogleAuthProvider }> = [];
  getRedirectResultCalls: Array<{ auth: Auth }> = [];
  signOutCalls: Array<{ auth: Auth }> = [];
  redirectResultUser: FirebaseUser = {
    uid: "u-1",
    displayName: "Test User",
    email: "test@example.com",
    photoURL: null,
  } as FirebaseUser;
  redirectResult: { user: FirebaseUser } | null = {
    user: this.redirectResultUser,
  };

  signInWithRedirect = async (auth: Auth, provider: GoogleAuthProvider) => {
    this.signInWithRedirectCalls.push({ auth, provider });
  };

  getRedirectResult = async (auth: Auth) => {
    this.getRedirectResultCalls.push({ auth });
    return this.redirectResult;
  };

  firebaseSignOut = async (auth: Auth) => {
    this.signOutCalls.push({ auth });
  };
}

class ProfileUpsertSpy {
  calls: Array<{ user: FirebaseUser }> = [];

  upsertProfile = async (user: FirebaseUser) => {
    this.calls.push({ user });
  };
}

function createService(overrides: Partial<AuthServiceDeps> = {}) {
  const authAdapter = new AuthAdapterSpy();
  const profileUpsert = new ProfileUpsertSpy();
  const provider = new GoogleAuthProvider();

  const deps: AuthServiceDeps = {
    auth: FAKE_AUTH,
    clock: () => FIXED_NOW,
    signInWithRedirect: authAdapter.signInWithRedirect,
    getRedirectResult: authAdapter.getRedirectResult,
    firebaseSignOut: authAdapter.firebaseSignOut,
    createGoogleProvider: () => provider,
    upsertProfile: profileUpsert.upsertProfile,
    ...overrides,
  };

  const service = new AuthService(deps);
  return { service, authAdapter, profileUpsert, provider };
}

describe("AuthService.signInWithGoogle", () => {
  it("starts Google sign-in with redirect to avoid popup COOP warnings", async () => {
    const { service, authAdapter, provider } = createService();

    await service.signInWithGoogle();

    expect(authAdapter.signInWithRedirectCalls.length).toBe(1);
    expect(authAdapter.signInWithRedirectCalls[0].auth).toBe(FAKE_AUTH);
    expect(authAdapter.signInWithRedirectCalls[0].provider).toBe(provider);
    expect(authAdapter.getRedirectResultCalls.length).toBe(0);
  });
});

describe("AuthService.handleGoogleRedirectResult", () => {
  it("upserts the user profile through the backend after redirect returns", async () => {
    const { service, authAdapter, profileUpsert } = createService();
    authAdapter.redirectResultUser = {
      uid: "new-user",
      displayName: "Newcomer",
      email: "new@example.com",
      photoURL: null,
    } as FirebaseUser;
    authAdapter.redirectResult = { user: authAdapter.redirectResultUser };

    await expect(service.handleGoogleRedirectResult()).resolves.toBe(true);

    expect(profileUpsert.calls).toEqual([
      { user: authAdapter.redirectResultUser },
    ]);
  });

  it("does nothing when there is no redirect result", async () => {
    const { service, authAdapter, profileUpsert } = createService();
    authAdapter.redirectResult = null;

    await expect(service.handleGoogleRedirectResult()).resolves.toBe(false);

    expect(profileUpsert.calls).toEqual([]);
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
