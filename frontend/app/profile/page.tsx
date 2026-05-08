"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import {
  ProfileCard,
  type ProfileCardData,
} from "@/components/profile/ProfileCard";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { SiteNav } from "@/components/site-nav/SiteNav";
import { SiteFooter } from "@/components/site-nav/SiteFooter";
import { getFirebaseAuth } from "@/lib/firebase";
import { buildProfileCardDataFromAuthUser } from "@/lib/profile/auth-user-profile";
import { fetchMyProfile, type UserProfile } from "@/lib/profile/profile-api";

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfilePageShell><ProfileSkeleton /></ProfilePageShell>}>
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfilePageContent() {
  const searchParams = useSearchParams();
  const viewedUid = searchParams.get("user") ?? "";
  const [profile, setProfile] = useState<ProfileCardData | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubAuth = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      setCurrentUser(user);
      setError("");
      setEditing(false);
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const fallback = buildProfileCardDataFromAuthUser(user);
      setProfile(fallback);
      void fetchMyProfile({ user, uid: viewedUid || undefined })
        .then((loaded) => setProfile(toProfileCardData(loaded, fallback)))
        .catch((caught) => {
          if (viewedUid) setProfile(null);
          setError(caught instanceof Error ? caught.message : "Profile load failed.");
        })
        .finally(() => setLoading(false));
    });
    return unsubAuth;
  }, [viewedUid]);

  return (
    <ProfilePageShell>
      {loading ? (
        <ProfileSkeleton />
      ) : viewedUid && !profile ? (
        <ProfileUnavailable error={error} />
      ) : !profile || !currentUser ? (
        <SignedOutPrompt />
      ) : viewedUid && viewedUid !== currentUser.uid ? (
        <div className="grid gap-gutter">
          <ProfileCard profile={{ ...profile, email: "" }} />
          {error ? (
            <p role="alert" className="font-body text-body-sm text-error">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-gutter lg:grid-cols-[1fr_0.85fr]">
          <ProfileCard
            profile={profile}
            editable
            onEdit={() => setEditing((value) => !value)}
          />
          {editing ? (
            <ProfileEditor
              user={currentUser}
              profile={toUserProfile(profile)}
              onSaved={(saved) => {
                setError("");
                setProfile(toProfileCardData(saved, profile));
                setEditing(false);
              }}
            />
          ) : (
            <ProfileEditHint onEdit={() => setEditing(true)} />
          )}
          {error ? (
            <p role="alert" className="font-body text-body-sm text-error lg:col-span-2">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </ProfilePageShell>
  );
}

function ProfileEditHint({ onEdit }: { readonly onEdit: () => void }) {
  return (
    <aside className="rounded-xl border border-outline-variant/30 bg-surface-container p-xl">
      <p className="font-label text-[11px] uppercase tracking-[0.22em] text-primary">
        Own profile
      </p>
      <h2 className="mt-xs font-h2 text-h2 text-on-surface">
        Your profile is editable
      </h2>
      <p className="mt-md font-body text-body-md text-on-surface-variant">
        Use the edit button to update your nickname, workplace, bio, and profile photo.
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="mt-lg rounded-xl bg-primary px-lg py-3 font-body text-body-md font-bold text-on-primary transition-opacity hover:opacity-90"
      >
        Edit profile
      </button>
    </aside>
  );
}

function ProfilePageShell({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <SiteNav active="profile" />
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-container-max px-gutter py-xl">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function toProfileCardData(
  profile: UserProfile,
  fallback: ProfileCardData,
): ProfileCardData {
  return {
    ...fallback,
    uid: profile.uid,
    displayName: profile.displayName || fallback.displayName,
    email: profile.email || fallback.email,
    photoURL: profile.photoURL || fallback.photoURL,
    description: profile.description,
    workplace: profile.workplace,
    uploadCount: profile.uploadCount,
    downloadCount: profile.downloadCount,
    reputation: profile.reputation,
  };
}

function toUserProfile(profile: ProfileCardData): UserProfile {
  return {
    uid: profile.uid,
    displayName: profile.displayName,
    email: profile.email,
    photoURL: profile.photoURL ?? "",
    description: profile.description,
    workplace: profile.workplace,
    uploadCount: profile.uploadCount,
    downloadCount: profile.downloadCount,
    reputation: profile.reputation,
  };
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

function ProfileUnavailable({ error }: { readonly error: string }) {
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-xl text-center">
      <h1 className="font-h2 text-h2 text-on-surface">Profile unavailable</h1>
      <p className="mt-md font-body text-body-md text-on-surface-variant">
        This profile is anonymous, private, or no longer available.
      </p>
      {error ? (
        <p role="alert" className="mt-md font-body text-body-sm text-error">
          {error}
        </p>
      ) : null}
      <Link
        href="/datasets"
        className="mt-lg inline-flex items-center rounded-xl bg-primary px-lg py-3 font-body text-body-md font-bold text-on-primary"
      >
        Back to explore
      </Link>
    </div>
  );
}
