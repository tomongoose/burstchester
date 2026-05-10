import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

import { GoogleRedirectHandler } from "@/components/auth/GoogleRedirectHandler";
import type { AuthService } from "@/lib/auth";

const onAuthStateChangedMock = vi.fn();

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: unknown[]) => onAuthStateChangedMock(...args),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: () => ({ name: "fake-auth" }),
}));

class AuthServiceSpy {
  redirected = false;
  signInCalls = 0;
  signOutCalls = 0;

  constructor(private readonly hasRedirectResult: boolean) {}

  signInWithGoogle = async (): Promise<void> => {
    this.signInCalls += 1;
  };

  handleGoogleRedirectResult = async (): Promise<boolean> => {
    this.redirected = true;
    return this.hasRedirectResult;
  };

  signOut = async (): Promise<void> => {
    this.signOutCalls += 1;
  };

  ensureUserProfile = async (): Promise<void> => {
    /* unused */
  };
}

describe("GoogleRedirectHandler", () => {
  beforeEach(() => {
    onAuthStateChangedMock.mockReset();
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      callback(null);
      return () => {};
    });
  });

  it("navigates home after a successful redirect login", async () => {
    const replace = vi.fn();
    const service = new AuthServiceSpy(true);

    render(
      <GoogleRedirectHandler
        authService={service as unknown as AuthService}
        navigateHome={replace}
      />,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });

  it("stays on the login page when there is no redirect result", async () => {
    const replace = vi.fn();
    const service = new AuthServiceSpy(false);

    render(
      <GoogleRedirectHandler
        authService={service as unknown as AuthService}
        navigateHome={replace}
      />,
    );

    await waitFor(() => {
      expect(service.redirected).toBe(true);
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("navigates home when a non-anonymous session is already restored", async () => {
    const replace = vi.fn();
    const service = new AuthServiceSpy(false);
    const getIdToken = vi.fn(async () => "cached-id-token");
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      callback({ uid: "google-user", isAnonymous: false, getIdToken });
      return () => {};
    });

    render(
      <GoogleRedirectHandler
        authService={service as unknown as AuthService}
        navigateHome={replace}
      />,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
    expect(getIdToken).toHaveBeenCalledTimes(1);
  });

  it("does not navigate home for restored anonymous sessions", async () => {
    const replace = vi.fn();
    const service = new AuthServiceSpy(false);
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      callback({
        uid: "anon-user",
        isAnonymous: true,
        getIdToken: vi.fn(async () => "anonymous-token"),
      });
      return () => {};
    });

    render(
      <GoogleRedirectHandler
        authService={service as unknown as AuthService}
        navigateHome={replace}
      />,
    );

    await waitFor(() => {
      expect(service.redirected).toBe(true);
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("stays on login when cached token validation fails", async () => {
    const replace = vi.fn();
    const service = new AuthServiceSpy(false);
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      callback({
        uid: "expired-user",
        isAnonymous: false,
        getIdToken: vi.fn(async () => {
          throw new Error("expired");
        }),
      });
      return () => {};
    });

    render(
      <GoogleRedirectHandler
        authService={service as unknown as AuthService}
        navigateHome={replace}
      />,
    );

    await waitFor(() => {
      expect(service.redirected).toBe(true);
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
