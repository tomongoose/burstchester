import { describe, it, expect } from "vitest";
import {
  GoogleAuthProvider,
  type Auth,
  type AuthCredential,
  type User as FirebaseUser,
} from "firebase/auth";

import { AuthService, type AuthServiceDeps } from "@/lib/auth";

const FAKE_AUTH = {} as Auth;
const FAKE_ANONYMOUS_AUTH = {
  currentUser: {
    uid: "anon-user",
    isAnonymous: true,
  },
} as Auth;
const FIXED_NOW = new Date("2026-05-05T00:00:00Z");

class AuthAdapterSpy {
  signInWithRedirectCalls: Array<{ auth: Auth; provider: GoogleAuthProvider }> = [];
  linkWithRedirectCalls: Array<{ user: FirebaseUser; provider: GoogleAuthProvider }> = [];
  getRedirectResultCalls: Array<{ auth: Auth }> = [];
  signInWithCredentialCalls: Array<{ auth: Auth; credential: AuthCredential }> = [];
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

  linkWithRedirect = async (user: FirebaseUser, provider: GoogleAuthProvider) => {
    this.linkWithRedirectCalls.push({ user, provider });
  };

  getRedirectResult = async (auth: Auth) => {
    this.getRedirectResultCalls.push({ auth });
    return this.redirectResult;
  };

  signInWithCredential = async (auth: Auth, credential: AuthCredential) => {
    this.signInWithCredentialCalls.push({ auth, credential });
    return {
      user: {
        uid: "existing-google-user",
        displayName: "Existing User",
        email: "existing@example.com",
        photoURL: null,
      } as FirebaseUser,
    };
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
    linkWithRedirect: authAdapter.linkWithRedirect,
    getRedirectResult: authAdapter.getRedirectResult,
    signInWithCredential: authAdapter.signInWithCredential,
    firebaseSignOut: authAdapter.firebaseSignOut,
    credentialFromRedirectError: () => null,
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

  it("links Google redirect onto an existing anonymous user", async () => {
    const { service, authAdapter, provider } = createService({
      auth: FAKE_ANONYMOUS_AUTH,
    });

    await service.signInWithGoogle();

    expect(authAdapter.signInWithRedirectCalls).toEqual([]);
    expect(authAdapter.linkWithRedirectCalls).toEqual([
      {
        user: FAKE_ANONYMOUS_AUTH.currentUser as FirebaseUser,
        provider,
      },
    ]);
  });

  it("falls back to Google sign-in when an anonymous link collides with an existing account", async () => {
    const authAdapter = new AuthAdapterSpy();
    const profileUpsert = new ProfileUpsertSpy();
    const provider = new GoogleAuthProvider();
    authAdapter.linkWithRedirect = async (user, nextProvider) => {
      authAdapter.linkWithRedirectCalls.push({ user, provider: nextProvider });
      throw Object.assign(new Error("credential already in use"), {
        code: "auth/credential-already-in-use",
      });
    };
    const service = new AuthService({
      auth: FAKE_ANONYMOUS_AUTH,
      clock: () => FIXED_NOW,
      signInWithRedirect: authAdapter.signInWithRedirect,
      linkWithRedirect: authAdapter.linkWithRedirect,
      getRedirectResult: authAdapter.getRedirectResult,
      signInWithCredential: authAdapter.signInWithCredential,
      firebaseSignOut: authAdapter.firebaseSignOut,
      credentialFromRedirectError: () => null,
      createGoogleProvider: () => provider,
      upsertProfile: profileUpsert.upsertProfile,
    });

    await service.signInWithGoogle();

    expect(authAdapter.linkWithRedirectCalls.length).toBe(1);
    expect(authAdapter.signOutCalls).toEqual([{ auth: FAKE_ANONYMOUS_AUTH }]);
    expect(authAdapter.signInWithRedirectCalls).toEqual([
      { auth: FAKE_ANONYMOUS_AUTH, provider },
    ]);
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

  it("signs into the existing Google account when redirect link resolution reports credential reuse", async () => {
    const authAdapter = new AuthAdapterSpy();
    const profileUpsert = new ProfileUpsertSpy();
    const provider = new GoogleAuthProvider();
    const credential = { providerId: "google.com", signInMethod: "google.com" } as AuthCredential;
    authAdapter.getRedirectResult = async (auth) => {
      authAdapter.getRedirectResultCalls.push({ auth });
      throw Object.assign(new Error("credential already in use"), {
        code: "auth/credential-already-in-use",
      });
    };
    const service = new AuthService({
      auth: FAKE_AUTH,
      clock: () => FIXED_NOW,
      signInWithRedirect: authAdapter.signInWithRedirect,
      linkWithRedirect: authAdapter.linkWithRedirect,
      getRedirectResult: authAdapter.getRedirectResult,
      signInWithCredential: authAdapter.signInWithCredential,
      firebaseSignOut: authAdapter.firebaseSignOut,
      credentialFromRedirectError: () => credential,
      createGoogleProvider: () => provider,
      upsertProfile: profileUpsert.upsertProfile,
    });

    await expect(service.handleGoogleRedirectResult()).resolves.toBe(true);

    expect(authAdapter.signOutCalls).toEqual([{ auth: FAKE_AUTH }]);
    expect(authAdapter.signInWithCredentialCalls).toEqual([
      { auth: FAKE_AUTH, credential },
    ]);
    expect(profileUpsert.calls[0]?.user.uid).toBe("existing-google-user");
  });

  it("restarts Google sign-in when redirect link resolution lacks a reusable credential", async () => {
    const authAdapter = new AuthAdapterSpy();
    const profileUpsert = new ProfileUpsertSpy();
    const provider = new GoogleAuthProvider();
    authAdapter.getRedirectResult = async (auth) => {
      authAdapter.getRedirectResultCalls.push({ auth });
      throw Object.assign(new Error("credential already in use"), {
        code: "auth/credential-already-in-use",
      });
    };
    const service = new AuthService({
      auth: FAKE_AUTH,
      clock: () => FIXED_NOW,
      signInWithRedirect: authAdapter.signInWithRedirect,
      linkWithRedirect: authAdapter.linkWithRedirect,
      getRedirectResult: authAdapter.getRedirectResult,
      signInWithCredential: authAdapter.signInWithCredential,
      firebaseSignOut: authAdapter.firebaseSignOut,
      credentialFromRedirectError: () => null,
      createGoogleProvider: () => provider,
      upsertProfile: profileUpsert.upsertProfile,
    });

    await expect(service.handleGoogleRedirectResult()).resolves.toBe(false);

    expect(authAdapter.signOutCalls).toEqual([{ auth: FAKE_AUTH }]);
    expect(authAdapter.signInWithRedirectCalls).toEqual([{ auth: FAKE_AUTH, provider }]);
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
