import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LoginSessionPanel } from "@/components/auth/LoginSessionPanel";

const onAuthStateChangedMock = vi.fn();

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: unknown[]) => onAuthStateChangedMock(...args),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: () => ({ name: "fake-auth" }),
}));

describe("LoginSessionPanel", () => {
  beforeEach(() => {
    onAuthStateChangedMock.mockReset();
  });

  it("shows an authenticated screen and schedules home navigation after token validation", async () => {
    const navigateHome = vi.fn();
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      callback({
        uid: "google-user",
        isAnonymous: false,
        getIdToken: vi.fn(async () => "oauth-id-token"),
      });
      return () => {};
    });

    render(<LoginSessionPanel navigateHome={navigateHome} redirectDelayMs={0} />);

    expect(await screen.findByText(/you're signed in/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(navigateHome).toHaveBeenCalledWith("/");
    });
  });

  it("does not show the authenticated screen for anonymous cached sessions", async () => {
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      callback({
        uid: "anon-user",
        isAnonymous: true,
        getIdToken: vi.fn(async () => "anonymous-token"),
      });
      return () => {};
    });

    render(<LoginSessionPanel />);

    await waitFor(() => {
      expect(onAuthStateChangedMock).toHaveBeenCalled();
    });
    expect(screen.queryByText(/you're signed in/i)).not.toBeInTheDocument();
  });

  it("logs out from the authenticated screen", async () => {
    const user = userEvent.setup();
    const signOut = vi.fn(async () => {});
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      callback({
        uid: "google-user",
        isAnonymous: false,
        getIdToken: vi.fn(async () => "oauth-id-token"),
      });
      return () => {};
    });

    render(
      <LoginSessionPanel
        redirectDelayMs={10_000}
        signOut={signOut}
      />,
    );

    await user.click(await screen.findByRole("button", { name: /logout/i }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
