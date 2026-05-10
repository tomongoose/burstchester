import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileCard } from "@/components/profile/ProfileCard";

const ALICE = {
  uid: "u-alice",
  displayName: "Alice Lee",
  email: "alice@example.com",
  photoURL: "https://example.com/alice.png",
  description: "I curate Korean legal datasets.",
  workplace: "Acme AI",
  uploadCount: 3,
  downloadCount: 12,
  points: 9000,
  reputation: 27,
};

describe("ProfileCard", () => {
  it("renders displayName and email", () => {
    render(<ProfileCard profile={ALICE} />);

    expect(screen.getByText("Alice Lee")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Acme AI")).toBeInTheDocument();
    expect(screen.getByText("I curate Korean legal datasets.")).toBeInTheDocument();
  });

  it("renders upload, download, and reputation counts", () => {
    render(<ProfileCard profile={ALICE} />);

    expect(screen.getByText(/uploads/i)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/downloads/i)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(/reputation/i)).toBeInTheDocument();
    expect(screen.getByText("27")).toBeInTheDocument();
  });

  it("shows initial fallback (first letter) when photoURL is null", () => {
    render(<ProfileCard profile={{ ...ALICE, photoURL: null }} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("A");
  });

  it("does not render profile editing controls", () => {
    render(<ProfileCard profile={ALICE} />);

    expect(screen.queryByRole("button", { name: /edit profile/i })).toBeNull();
  });
});
