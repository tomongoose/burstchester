import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LoginButton } from "@/components/auth/LoginButton";
import type { AuthService } from "@/lib/auth";

class AuthServiceSpy {
  signInCalls = 0;
  signOutCalls = 0;

  signInWithGoogle = async (): Promise<void> => {
    this.signInCalls += 1;
  };

  signOut = async (): Promise<void> => {
    this.signOutCalls += 1;
  };

  ensureUserProfile = async (): Promise<void> => {
    /* unused */
  };
}

describe("LoginButton", () => {
  it("invokes AuthService.signInWithGoogle on click", async () => {
    const spy = new AuthServiceSpy();
    render(<LoginButton authService={spy as unknown as AuthService} />);

    await userEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(spy.signInCalls).toBe(1);
  });
});
