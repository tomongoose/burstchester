"use client";

import { useState, type JSX } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoginButton } from "@/components/auth/LoginButton";
import { LoginSessionPanel } from "@/components/auth/LoginSessionPanel";
import {
  getDefaultAuthService,
  isUserCancelledPopupError,
  type AuthService,
} from "@/lib/auth";

interface LoginCardBodyProps {
  readonly authService?: AuthService;
}

export function LoginCardBody({
  authService,
}: LoginCardBodyProps = {}): JSX.Element {
  const { status } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(): Promise<void> {
    setError(null);
    setSigningIn(true);
    try {
      const service = authService ?? getDefaultAuthService();
      await service.signInWithGoogle();
      // Keep signingIn=true; AuthProvider will flip status to 'authed',
      // LoginSessionPanel will take over and navigate after its delay.
    } catch (caught) {
      if (!isUserCancelledPopupError(caught)) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Sign-in failed. Please try again.",
        );
      }
      setSigningIn(false);
    }
  }

  if (status === "authed") {
    return <LoginSessionPanel />;
  }

  if (signingIn) {
    return <SigningInPanel />;
  }

  return (
    <>
      <LoginButton onClick={() => void handleSignIn()} />
      {error ? (
        <p
          role="alert"
          className="mt-md w-full rounded-md border border-error/40 bg-error-container/15 p-md text-left font-body text-body-sm text-error"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}

function SigningInPanel(): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full items-center gap-md rounded-xl border border-primary/30 bg-primary-container/15 p-md text-left"
    >
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/40 border-t-primary"
      />
      <div className="min-w-0">
        <p className="font-label text-[11px] uppercase tracking-[0.22em] text-primary">
          Signing you in
        </p>
        <p className="mt-xs font-body text-body-sm text-on-surface-variant">
          Setting up your account, just a moment...
        </p>
      </div>
    </div>
  );
}
