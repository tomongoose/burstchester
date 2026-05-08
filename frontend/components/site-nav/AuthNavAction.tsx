"use client";

import { useEffect, useState, type JSX } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { getDefaultAuthService } from "@/lib/auth";
import { validateRestoredLoginUser } from "@/lib/auth/restored-session";
import { getFirebaseAuth } from "@/lib/firebase";

interface AuthNavActionProps {
  readonly currentUser?: Pick<FirebaseUser, "uid"> | null;
  readonly signOut?: () => Promise<void>;
}

export function AuthNavAction({
  currentUser,
  signOut,
}: AuthNavActionProps = {}): JSX.Element {
  const [observedUser, setObservedUser] = useState<Pick<FirebaseUser, "uid"> | null>(null);
  const controlled = currentUser !== undefined;
  const displayedUser = controlled ? currentUser : observedUser;

  useEffect(() => {
    if (controlled) return;

    let active = true;
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
      void validateRestoredLoginUser(user)
        .then((validatedUser) => {
          if (active) setObservedUser(validatedUser);
        })
        .catch(() => {
          if (active) setObservedUser(null);
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [controlled]);

  if (!displayedUser) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center rounded-md bg-primary-container px-4 py-2 font-label text-[11px] uppercase tracking-[0.22em] text-on-primary-container transition-opacity hover:opacity-85"
      >
        Sign in
      </Link>
    );
  }

  async function handleSignOut(): Promise<void> {
    if (signOut) {
      await signOut();
      return;
    }

    await getDefaultAuthService().signOut();
    setObservedUser(null);
  }

  return (
    <button
      type="button"
      onClick={() => {
        void handleSignOut();
      }}
      className="inline-flex items-center rounded-md bg-primary-container px-4 py-2 font-label text-[11px] uppercase tracking-[0.22em] text-on-primary-container transition-opacity hover:opacity-85"
    >
      Logout
    </button>
  );
}
