"use client";

import type { JSX } from "react";
import { signInWithGoogle } from "@/lib/auth";

export function LoginButton(): JSX.Element {
  return (
    <button type="button" onClick={() => void signInWithGoogle()}>
      Sign in with Google
    </button>
  );
}
