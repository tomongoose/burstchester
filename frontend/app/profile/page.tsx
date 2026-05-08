"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import {
  ProfileCard,
  type ProfileCardData,
} from "@/components/profile/ProfileCard";
import { SiteNav } from "@/components/site-nav/SiteNav";
import { SiteFooter } from "@/components/site-nav/SiteFooter";
import { getFirebaseAuth } from "@/lib/firebase";
import { buildProfileCardDataFromAuthUser } from "@/lib/profile/auth-user-profile";

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubAuth = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setProfile(buildProfileCardDataFromAuthUser(user));
      setLoading(false);
    });
    return unsubAuth;
  }, []);

  return (
    <>
      <SiteNav active="profile" />
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-container-max px-gutter py-xl">
          {loading ? (
            <ProfileSkeleton />
          ) : !profile ? (
            <SignedOutPrompt />
          ) : (
            <ProfileCard profile={profile} />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function ProfileSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container">
      <div className="h-32 animate-pulse bg-surface-container-high" />
      <div className="-mt-12 px-xl pb-xl">
        <div className="flex items-end gap-lg">
          <div className="h-24 w-24 animate-pulse rounded-full border-4 border-surface-container bg-surface-container-high" />
          <div className="flex-1 space-y-sm">
            <div className="h-8 w-1/2 animate-pulse rounded bg-surface-container-high" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-container" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SignedOutPrompt() {
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-xl text-center">
      <h1 className="font-h2 text-h2 text-on-surface">You’re not signed in</h1>
      <p className="mt-md font-body text-body-md text-on-surface-variant">
        Sign in with Google to view your profile and uploads.
      </p>
      <Link
        href="/login"
        className="mt-lg inline-flex items-center rounded-xl bg-primary px-lg py-3 font-body text-body-md font-bold text-on-primary"
      >
        Sign in
      </Link>
    </div>
  );
}
