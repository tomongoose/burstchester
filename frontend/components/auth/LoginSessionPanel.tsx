"use client";

import { useEffect, useState, type JSX } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getDefaultAuthService } from "@/lib/auth";
import { validateRestoredLoginUser } from "@/lib/auth/restored-session";
import { getFirebaseAuth } from "@/lib/firebase";

interface LoginSessionPanelProps {
  readonly navigateHome?: (href: string) => void;
  readonly redirectDelayMs?: number;
  readonly signOut?: () => Promise<void>;
}

export function LoginSessionPanel({
  navigateHome = (href) => {
    window.location.assign(href);
  },
  redirectDelayMs = 700,
  signOut,
}: LoginSessionPanelProps = {}): JSX.Element | null {
  const [validatedUid, setValidatedUid] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
      void validateRestoredLoginUser(user)
        .then((validatedUser) => {
          if (!active || !validatedUser) return;
          setValidatedUid(validatedUser.uid);
        })
        .catch(() => {
          if (active) setValidatedUid(null);
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!validatedUid) return;
    const timeout = window.setTimeout(() => {
      navigateHome("/");
    }, redirectDelayMs);
    return () => window.clearTimeout(timeout);
  }, [navigateHome, redirectDelayMs, validatedUid]);

  if (!validatedUid) return null;

  async function handleLogout(): Promise<void> {
    if (signOut) {
      await signOut();
    } else {
      await getDefaultAuthService().signOut();
    }
    setValidatedUid(null);
  }

  return (
    <div className="mb-md w-full rounded-xl border border-primary/30 bg-primary-container/15 p-md text-left">
      <p className="font-label text-[11px] uppercase tracking-[0.22em] text-primary">
        OAuth token verified
      </p>
      <h3 className="mt-xs font-h3 text-h3 text-on-surface">
        You&apos;re signed in
      </h3>
      <p className="mt-xs font-body text-body-sm text-on-surface-variant">
        Moving to the main page. You can log out here if this is not your account.
      </p>
      <div className="mt-md flex flex-wrap gap-sm">
        <button
          type="button"
          onClick={() => navigateHome("/")}
          className="rounded-md bg-primary px-md py-2 font-label text-[11px] uppercase tracking-[0.2em] text-on-primary"
        >
          Continue home
        </button>
        <button
          type="button"
          onClick={() => {
            void handleLogout();
          }}
          className="rounded-md border border-primary/40 px-md py-2 font-label text-[11px] uppercase tracking-[0.2em] text-primary"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
