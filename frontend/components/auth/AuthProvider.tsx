"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { validateRestoredLoginUser } from "@/lib/auth/restored-session";
import {
  clearCachedAuthUser,
  readCachedAuthUser,
  writeCachedAuthUser,
  type CachedAuthUser,
} from "@/lib/auth/auth-cache";

export type AuthStatus = "loading" | "authed" | "guest";

export interface AuthContextValue {
  readonly status: AuthStatus;
  readonly user: FirebaseUser | null;
  readonly cachedSnapshot: CachedAuthUser | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const SSR_DEFAULT: AuthContextValue = {
  status: "loading",
  user: null,
  cachedSnapshot: null,
};

export function AuthProvider({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [cachedSnapshot, setCachedSnapshot] = useState<CachedAuthUser | null>(null);

  useEffect(() => {
    setCachedSnapshot(readCachedAuthUser());
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (firebaseUser) => {
      void validateRestoredLoginUser(firebaseUser)
        .then((validated) => {
          if (!active) return;
          if (validated && firebaseUser) {
            const snapshot: CachedAuthUser = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName ?? "",
              photoURL: firebaseUser.photoURL ?? "",
            };
            setUser(firebaseUser);
            setCachedSnapshot(snapshot);
            setStatus("authed");
            writeCachedAuthUser(snapshot);
          } else {
            setUser(null);
            setCachedSnapshot(null);
            setStatus("guest");
            clearCachedAuthUser();
          }
        })
        .catch(() => {
          if (!active) return;
          setUser(null);
          setCachedSnapshot(null);
          setStatus("guest");
          clearCachedAuthUser();
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, cachedSnapshot }),
    [status, user, cachedSnapshot],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  return ctx ?? SSR_DEFAULT;
}
