import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User as FirebaseUser } from "firebase/auth";

import { AuthNavAction } from "@/components/site-nav/AuthNavAction";
import { TestAuthProvider } from "../auth/test-auth-provider";

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: () => ({ name: "fake-auth" }),
}));

describe("AuthNavAction", () => {
  it("links to sign in while signed out", () => {
    render(<AuthNavAction currentUser={null} />);

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("shows a logout button for signed-in users", async () => {
    const user = userEvent.setup();
    const signOut = vi.fn(async () => {});

    render(
      <AuthNavAction
        currentUser={{ uid: "user-1" }}
        signOut={signOut}
      />,
    );

    await user.click(screen.getByRole("button", { name: /logout/i }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("shows the profile nickname and point balance before logout", async () => {
    const fetchProfile = vi.fn(async () => ({
      uid: "user-1",
      displayName: "Alice",
      email: "alice@example.com",
      photoURL: "",
      description: "",
      workplace: "",
      uploadCount: 0,
      downloadCount: 0,
      points: 12345,
      reputation: 0,
    }));

    render(
      <AuthNavAction
        currentUser={{
          uid: "user-1",
          displayName: "Fallback",
          getIdToken: vi.fn(async () => "id-token"),
        }}
        fetchProfile={fetchProfile}
      />,
    );

    expect(await screen.findByRole("link", { name: "Alice" })).toHaveAttribute(
      "href",
      "/profile?user=user-1",
    );
    expect(screen.getByRole("link", { name: /12,345 pts/i })).toHaveAttribute(
      "href",
      "/points",
    );
    expect(screen.getByRole("button", { name: /logout/i }).compareDocumentPosition(
      screen.getByRole("link", { name: "Alice" }),
    )).toBe(Node.DOCUMENT_POSITION_PRECEDING);
  });

  it("shows logout when an authed session is provided through context", () => {
    const fakeUser = {
      uid: "ctx-user",
      displayName: "Ctx User",
    } as FirebaseUser;

    render(
      <TestAuthProvider status="authed" user={fakeUser}>
        <AuthNavAction />
      </TestAuthProvider>,
    );

    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });

  it("renders the cached snapshot optimistically while status is loading", () => {
    render(
      <TestAuthProvider
        status="loading"
        cachedSnapshot={{ uid: "cached-user", displayName: "Cached", photoURL: "" }}
      >
        <AuthNavAction />
      </TestAuthProvider>,
    );

    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cached/i })).toBeInTheDocument();
  });

  it("keeps sign in when context reports guest status", () => {
    render(
      <TestAuthProvider status="guest">
        <AuthNavAction />
      </TestAuthProvider>,
    );

    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });
});
