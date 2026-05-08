"use client";

import { useEffect, type JSX } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getDefaultAuthService, type AuthService } from "@/lib/auth";
import { validateRestoredLoginUser } from "@/lib/auth/restored-session";
import { getFirebaseAuth } from "@/lib/firebase";

interface GoogleRedirectHandlerProps {
  readonly authService?: AuthService;
  readonly navigateHome?: (href: string) => void;
}

export function GoogleRedirectHandler({
  authService,
  navigateHome = (href) => {
    window.location.assign(href);
  },
}: GoogleRedirectHandlerProps = {}): JSX.Element | null {
  useEffect(() => {
    const service = authService ?? getDefaultAuthService();
    void service
      .handleGoogleRedirectResult()
      .then((handled) => {
        if (handled) navigateHome("/");
      })
      .catch((error) => {
        console.error("Google redirect sign-in failed", error);
      });
  }, [authService, navigateHome]);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
      void validateRestoredLoginUser(user)
        .then((validatedUser) => {
          if (active && validatedUser) {
            navigateHome("/");
          }
        })
        .catch(() => {
          // A cached Firebase user with an invalid token is not an active login.
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigateHome]);

  return null;
}
