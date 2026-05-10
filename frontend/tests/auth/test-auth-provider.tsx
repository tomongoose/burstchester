import type { JSX, ReactNode } from "react";
import { type User as FirebaseUser } from "firebase/auth";
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from "@/components/auth/AuthProvider";
import type { CachedAuthUser } from "@/lib/auth/auth-cache";

interface TestAuthProviderProps {
  readonly status?: AuthStatus;
  readonly user?: FirebaseUser | null;
  readonly cachedSnapshot?: CachedAuthUser | null;
  readonly children: ReactNode;
}

export function TestAuthProvider({
  status = "guest",
  user = null,
  cachedSnapshot = null,
  children,
}: TestAuthProviderProps): JSX.Element {
  const value: AuthContextValue = { status, user, cachedSnapshot };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
