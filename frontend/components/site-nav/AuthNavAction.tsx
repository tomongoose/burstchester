"use client";

import { useEffect, useMemo, useState, type JSX } from "react";
import Link from "next/link";
import { type User as FirebaseUser } from "firebase/auth";
import { getDefaultAuthService } from "@/lib/auth";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  POINT_BALANCE_EVENT,
  readCachedPointBalance,
  writeCachedPointBalance,
} from "@/lib/points/balance";
import { fetchMyProfile } from "@/lib/profile/profile-api";
import { buildProfileHref } from "@/lib/profile/routes";

interface AuthNavActionProps {
  readonly currentUser?: NavUser | null;
  readonly signOut?: () => Promise<void>;
  readonly fetchProfile?: typeof fetchMyProfile;
}

export function AuthNavAction({
  currentUser,
  signOut,
  fetchProfile = fetchMyProfile,
}: AuthNavActionProps = {}): JSX.Element {
  const { user, cachedSnapshot } = useAuth();
  const [loadedProfileName, setLoadedProfileName] = useState<{
    readonly uid: string;
    readonly name: string;
    readonly points: number;
  } | null>(null);
  const [cachedPoints, setCachedPoints] = useState(readCachedPointBalance);
  const controlled = currentUser !== undefined;
  const displayedUser = useMemo<NavUser | null>(() => {
    if (controlled) return currentUser ?? null;
    if (user) return user;
    if (cachedSnapshot) {
      return {
        uid: cachedSnapshot.uid,
        displayName: cachedSnapshot.displayName,
      };
    }
    return null;
  }, [controlled, currentUser, user, cachedSnapshot]);

  const fallbackName = displayedUser ? buildFallbackName(displayedUser) : "";
  const profileName =
    displayedUser && loadedProfileName?.uid === displayedUser.uid
      ? loadedProfileName.name
      : fallbackName;
  const profilePoints =
    displayedUser && loadedProfileName?.uid === displayedUser.uid
      ? loadedProfileName.points
      : cachedPoints;

  useEffect(() => {
    let active = true;
    if (!displayedUser) return () => {
      active = false;
    };

    if (!hasProfileToken(displayedUser)) return () => {
      active = false;
    };

    void fetchProfile({ user: displayedUser })
      .then((profile) => {
        if (active) {
          const points = writeCachedPointBalance(profile.points);
          setLoadedProfileName({
            uid: displayedUser.uid,
            name: profile.displayName || fallbackName,
            points,
          });
          setCachedPoints(points);
        }
      })
      .catch(() => {
        // Keep the auth-derived fallback name when the profile function is unavailable.
      });

    return () => {
      active = false;
    };
  }, [displayedUser, fallbackName, fetchProfile]);

  useEffect(() => {
    function handlePointBalanceUpdate(event: Event): void {
      const points = event instanceof CustomEvent
        ? Number(event.detail?.points)
        : readCachedPointBalance();
      setCachedPoints(Number.isFinite(points) && points >= 0
        ? Math.floor(points)
        : readCachedPointBalance());
    }

    window.addEventListener(POINT_BALANCE_EVENT, handlePointBalanceUpdate);
    window.addEventListener("storage", handlePointBalanceUpdate);
    return () => {
      window.removeEventListener(POINT_BALANCE_EVENT, handlePointBalanceUpdate);
      window.removeEventListener("storage", handlePointBalanceUpdate);
    };
  }, []);

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
  }

  return (
    <div className="flex min-w-0 items-center gap-sm">
      <Link
        href={buildProfileHref(displayedUser.uid)}
        className="hidden max-w-36 truncate rounded-md border border-outline-variant/30 px-3 py-2 font-label text-[11px] uppercase tracking-[0.18em] text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary sm:inline-flex"
        title={profileName || displayedUser.uid}
      >
        {profileName || displayedUser.uid}
      </Link>
      <Link
        href="/points"
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-3 py-2 font-label text-[11px] uppercase tracking-[0.16em] text-primary transition-colors hover:border-primary/50 hover:bg-primary/15"
        title="Point policy"
      >
        <span className="material-symbols-outlined text-sm">toll</span>
        {profilePoints.toLocaleString()} pts
      </Link>
      <button
        type="button"
        onClick={() => {
          void handleSignOut();
        }}
        className="inline-flex items-center rounded-md bg-primary-container px-4 py-2 font-label text-[11px] uppercase tracking-[0.22em] text-on-primary-container transition-opacity hover:opacity-85"
      >
        Logout
      </button>
    </div>
  );
}

type NavUser = Pick<FirebaseUser, "uid"> & Partial<Pick<
  FirebaseUser,
  "displayName" | "isAnonymous" | "getIdToken"
>>;

function buildFallbackName(user: NavUser): string {
  return user.displayName?.trim()
    || (user.isAnonymous ? "Anonymous" : "Burstchester user");
}

function hasProfileToken(user: NavUser): user is NavUser & {
  readonly getIdToken: () => Promise<string>;
} {
  return typeof user.getIdToken === "function";
}
