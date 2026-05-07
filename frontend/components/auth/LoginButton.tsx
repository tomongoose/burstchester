"use client";

import type { JSX } from "react";
import { getDefaultAuthService, type AuthService } from "@/lib/auth";

interface LoginButtonProps {
  readonly authService?: AuthService;
}

export function LoginButton({
  authService,
}: LoginButtonProps = {}): JSX.Element {
  const handleClick = () => {
    const service = authService ?? getDefaultAuthService();
    void service.signInWithGoogle();
  };

  return (
    <button type="button" onClick={handleClick}>
      Sign in with Google
    </button>
  );
}
