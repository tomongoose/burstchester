import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileCard } from "@/components/profile/ProfileCard";

const ALICE = {
  uid: "u-alice",
  displayName: "Alice Lee",
  email: "alice@example.com",
  photoURL: "https://example.com/alice.png",
  uploadCount: 3,
  downloadCount: 12,
  reputation: 27,
};

describe("ProfileCard", () => {
  it("renders displayName and email", () => {
    render(<ProfileCard profile={ALICE} />);

    expect(screen.getByText("Alice Lee")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("renders upload and download counts", () => {
    render(<ProfileCard profile={ALICE} />);

    expect(screen.getByText(/3.*uploaded/i)).toBeInTheDocument();
    expect(screen.getByText(/12.*downloaded/i)).toBeInTheDocument();
  });

  it("shows initial fallback (first letter) when photoURL is null", () => {
    render(<ProfileCard profile={{ ...ALICE, photoURL: null }} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("A");
  });
});
