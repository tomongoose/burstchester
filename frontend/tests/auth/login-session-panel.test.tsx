import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User as FirebaseUser } from "firebase/auth";

import { LoginSessionPanel } from "@/components/auth/LoginSessionPanel";
import { TestAuthProvider } from "./test-auth-provider";

describe("LoginSessionPanel", () => {
  it("shows an authenticated screen and schedules home navigation when status is authed", async () => {
    const navigateHome = vi.fn();
    const user = { uid: "google-user" } as FirebaseUser;

    render(
      <TestAuthProvider status="authed" user={user}>
        <LoginSessionPanel navigateHome={navigateHome} redirectDelayMs={0} />
      </TestAuthProvider>,
    );

    expect(screen.getByText(/you're signed in/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(navigateHome).toHaveBeenCalledWith("/");
    });
  });

  it("does not show the authenticated screen while status is loading", () => {
    render(
      <TestAuthProvider status="loading">
        <LoginSessionPanel />
      </TestAuthProvider>,
    );

    expect(screen.queryByText(/you're signed in/i)).not.toBeInTheDocument();
  });

  it("does not show the authenticated screen for guest sessions", () => {
    render(
      <TestAuthProvider status="guest">
        <LoginSessionPanel />
      </TestAuthProvider>,
    );

    expect(screen.queryByText(/you're signed in/i)).not.toBeInTheDocument();
  });

  it("logs out from the authenticated screen", async () => {
    const user = userEvent.setup();
    const signOut = vi.fn(async () => {});
    const fakeFirebaseUser = { uid: "google-user" } as FirebaseUser;

    render(
      <TestAuthProvider status="authed" user={fakeFirebaseUser}>
        <LoginSessionPanel redirectDelayMs={10_000} signOut={signOut} />
      </TestAuthProvider>,
    );

    await user.click(screen.getByRole("button", { name: /logout/i }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
