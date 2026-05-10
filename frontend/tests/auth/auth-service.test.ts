import { describe, it, expect } from "vitest";
import {
  GoogleAuthProvider,
  type Auth,
  type User as FirebaseUser,
  type UserCredential,
} from "firebase/auth";

import { AuthService, type AuthServiceDeps, isUserCancelledPopupError } from "@/lib/auth";

const FAKE_AUTH = {} as Auth;
const FAKE_ANONYMOUS_AUTH = {
  currentUser: {
    uid: "anon-user",
    isAnonymous: true,
  },
} as Auth;
const FIXED_NOW = new Date("2026-05-05T00:00:00Z");

const POPUP_USER: FirebaseUser = {
  uid: "u-1",
  displayName: "Test User",
  email: "test@example.com",
  photoURL: null,
} as FirebaseUser;

class AuthAdapterSpy {
  signInWithPopupCalls: Array<{ auth: Auth; provider: GoogleAuthProvider }> = [];
  linkWithPopupCalls: Array<{ user: FirebaseUser; provider: GoogleAuthProvider }> = [];
  signOutCalls: Array<{ auth: Auth }> = [];
  popupResultUser: FirebaseUser = POPUP_USER;

  signInWithPopup = async (auth: Auth, provider: GoogleAuthProvider): Promise<UserCredential> => {
    this.signInWithPopupCalls.push({ auth, provider });
    return { user: this.popupResultUser } as UserCredential;
  };

  linkWithPopup = async (user: FirebaseUser, provider: GoogleAuthProvider): Promise<UserCredential> => {
    this.linkWithPopupCalls.push({ user, provider });
    return { user: this.popupResultUser } as UserCredential;
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
    signInWithPopup: authAdapter.signInWithPopup,
    linkWithPopup: authAdapter.linkWithPopup,
    firebaseSignOut: authAdapter.firebaseSignOut,
    credentialFromError: () => null,
    createGoogleProvider: () => provider,
    upsertProfile: profileUpsert.upsertProfile,
    ...overrides,
  };

  const service = new AuthService(deps);
  return { service, authAdapter, profileUpsert, provider };
}

describe("AuthService.signInWithGoogle", () => {
  it("opens a Google popup, upserts the profile, and returns the user", async () => {
    const { service, authAdapter, profileUpsert, provider } = createService();

    const result = await service.signInWithGoogle();

    expect(authAdapter.signInWithPopupCalls).toEqual([
      { auth: FAKE_AUTH, provider },
    ]);
    expect(profileUpsert.calls).toEqual([{ user: POPUP_USER }]);
    expect(result?.uid).toBe("u-1");
  });

  it("links Google credentials onto an existing anonymous user via popup", async () => {
    const { service, authAdapter, provider } = createService({
      auth: FAKE_ANONYMOUS_AUTH,
    });

    await service.signInWithGoogle();

    expect(authAdapter.signInWithPopupCalls).toEqual([]);
    expect(authAdapter.linkWithPopupCalls).toEqual([
      {
        user: FAKE_ANONYMOUS_AUTH.currentUser as FirebaseUser,
        provider,
      },
    ]);
  });

  it("falls back to fresh popup sign-in when an anonymous link collides with an existing account", async () => {
    const authAdapter = new AuthAdapterSpy();
    const profileUpsert = new ProfileUpsertSpy();
    const provider = new GoogleAuthProvider();
    authAdapter.linkWithPopup = async (user, nextProvider) => {
      authAdapter.linkWithPopupCalls.push({ user, provider: nextProvider });
      throw Object.assign(new Error("credential already in use"), {
        code: "auth/credential-already-in-use",
      });
    };
    const service = new AuthService({
      auth: FAKE_ANONYMOUS_AUTH,
      clock: () => FIXED_NOW,
      signInWithPopup: authAdapter.signInWithPopup,
      linkWithPopup: authAdapter.linkWithPopup,
      firebaseSignOut: authAdapter.firebaseSignOut,
      credentialFromError: () => null,
      createGoogleProvider: () => provider,
      upsertProfile: profileUpsert.upsertProfile,
    });

    await service.signInWithGoogle();

    expect(authAdapter.linkWithPopupCalls.length).toBe(1);
    expect(authAdapter.signOutCalls).toEqual([{ auth: FAKE_ANONYMOUS_AUTH }]);
    expect(authAdapter.signInWithPopupCalls).toEqual([
      { auth: FAKE_ANONYMOUS_AUTH, provider },
    ]);
    expect(profileUpsert.calls.length).toBe(1);
  });

  it("propagates upsert failures so the caller can surface them", async () => {
    const failingUpsert = async () => {
      throw new Error("backend down");
    };
    const { service } = createService({ upsertProfile: failingUpsert });

    await expect(service.signInWithGoogle()).rejects.toThrow(/backend down/);
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

describe("isUserCancelledPopupError", () => {
  it("recognises common Firebase popup-cancellation codes", () => {
    expect(isUserCancelledPopupError({ code: "auth/popup-closed-by-user" })).toBe(true);
    expect(isUserCancelledPopupError({ code: "auth/cancelled-popup-request" })).toBe(true);
    expect(isUserCancelledPopupError({ code: "auth/user-cancelled" })).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isUserCancelledPopupError(null)).toBe(false);
    expect(isUserCancelledPopupError(new Error("network"))).toBe(false);
    expect(isUserCancelledPopupError({ code: "auth/internal-error" })).toBe(false);
  });
});
