"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { buildDatasetDetailHref } from "@/lib/datasets/routes";
import { fetchDatasetSummaries } from "@/lib/datasets/list-datasets";
import type { DatasetSummary } from "@/lib/domain/dataset-summary";
import { SearchFilter } from "@/lib/domain/search-filter";
import type { ModelSummary } from "@/lib/domain/model-summary";
import { fetchModelSummaries } from "@/lib/models/list-models";
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
  const [profileDatasets, setProfileDatasets] = useState<readonly DatasetSummary[]>([]);
  const [profileModels, setProfileModels] = useState<readonly ModelSummary[]>([]);
  const [error, setError] = useState("");
  const [assetsError, setAssetsError] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubAuth = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      setCurrentUser(user);
      setError("");
      setAssetsError("");
      setProfileDatasets([]);
      setProfileModels([]);
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

  useEffect(() => {
    if (loading || !currentUser || !profile?.uid) return;

    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return Promise.reject(new Error("Profile asset load cancelled."));
        setAssetsLoading(true);
        setAssetsError("");
        return Promise.all([
          fetchDatasetSummaries({
            filter: SearchFilter.create({}),
            sort: "newest",
            ownerUid: profile.uid,
          }),
          fetchModelSummaries({
            sort: "newest",
            ownerUid: profile.uid,
          }),
        ]);
      })
      .then(([datasets, models]) => {
        if (!active) return;
        setProfileDatasets(datasets);
        setProfileModels(models);
      })
      .catch((caught) => {
        if (!active) return;
        setAssetsError(caught instanceof Error ? caught.message : "Profile assets failed to load.");
      })
      .finally(() => {
        if (active) setAssetsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser, loading, profile?.uid]);

  const isOwnProfile = Boolean(profile && currentUser && profile.uid === currentUser.uid);

  return (
    <ProfilePageShell>
      {loading ? (
        <ProfileSkeleton />
      ) : viewedUid && !profile ? (
        <ProfileUnavailable error={error} />
      ) : !profile || !currentUser ? (
        <SignedOutPrompt />
      ) : !isOwnProfile ? (
        <div className="grid gap-gutter">
          <ProfileHero profile={{ ...profile, email: "" }} />
          <ProfileAssetsShowcase
            datasets={profileDatasets}
            models={profileModels}
            loading={assetsLoading}
            error={assetsError}
          />
          {error ? (
            <p role="alert" className="font-body text-body-sm text-error">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-gutter">
          <div className="grid gap-gutter lg:grid-cols-[1fr_0.78fr]">
            <ProfileHero
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
          </div>
          <ProfileAssetsShowcase
            datasets={profileDatasets}
            models={profileModels}
            loading={assetsLoading}
            error={assetsError}
          />
          {error ? (
            <p role="alert" className="font-body text-body-sm text-error">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </ProfilePageShell>
  );
}

function ProfileHero({
  profile,
  editable = false,
  onEdit,
}: {
  readonly profile: ProfileCardData;
  readonly editable?: boolean;
  readonly onEdit?: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(16,24,39,0.96),rgba(12,18,31,0.92))] p-lg shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(245,158,11,0.24),transparent_32%),radial-gradient(circle_at_86%_8%,rgba(45,212,191,0.2),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_45%)]" />
      <div className="relative grid gap-lg xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-sm backdrop-blur">
          <ProfileCard profile={profile} editable={editable} onEdit={onEdit} />
        </div>
        <div className="flex min-h-72 flex-col justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-xl">
          <div>
            <p className="font-label text-[11px] uppercase tracking-[0.26em] text-primary">
              Creator profile
            </p>
            <h2 className="mt-sm max-w-xl font-h1 text-[clamp(2rem,5vw,4.5rem)] font-black leading-[0.9] text-on-surface">
              {profile.displayName} builds reusable AI assets.
            </h2>
            <p className="mt-md max-w-2xl font-body text-body-lg text-on-surface-variant">
              Explore the datasets and models this creator has published, then open the assets you need for CLI training or evaluation.
            </p>
          </div>
          <dl className="mt-xl grid grid-cols-3 gap-sm">
            <HeroMetric label="Uploads" value={profile.uploadCount} />
            <HeroMetric label="Downloads" value={profile.downloadCount} />
            <HeroMetric label="Reputation" value={profile.reputation} />
          </dl>
        </div>
      </div>
    </section>
  );
}

function HeroMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/70 p-md">
      <dt className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
        {label}
      </dt>
      <dd className="mt-xs font-h1 text-h2 font-black text-on-surface">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

function ProfileEditHint({ onEdit }: { readonly onEdit: () => void }) {
  return (
    <aside className="overflow-hidden rounded-[2rem] border border-outline-variant/30 bg-surface-container p-xl">
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

function ProfileAssetsShowcase({
  datasets,
  models,
  loading,
  error,
}: {
  readonly datasets: readonly DatasetSummary[];
  readonly models: readonly ModelSummary[];
  readonly loading: boolean;
  readonly error: string;
}) {
  return (
    <section className="rounded-[2rem] border border-outline-variant/30 bg-surface-container p-lg">
      <div className="flex flex-wrap items-end justify-between gap-md">
        <div>
          <p className="font-label text-[11px] uppercase tracking-[0.26em] text-primary">
            Published assets
          </p>
          <h2 className="mt-xs font-h2 text-h1 text-on-surface">
            Datasets and models
          </h2>
        </div>
        <p className="font-body text-body-sm text-on-surface-variant">
          {loading ? "Loading uploads..." : `${datasets.length} datasets · ${models.length} models`}
        </p>
      </div>
      {error ? (
        <p role="alert" className="mt-md font-body text-body-sm text-error">
          {error}
        </p>
      ) : null}
      <div className="mt-lg grid gap-lg xl:grid-cols-2">
        <AssetColumn title="Datasets" emptyText="No datasets published yet.">
          {datasets.map((dataset) => (
            <DatasetAssetCard key={dataset.id} dataset={dataset} />
          ))}
        </AssetColumn>
        <AssetColumn title="Models" emptyText="No models published yet.">
          {models.map((model) => (
            <ModelAssetCard key={model.id} model={model} />
          ))}
        </AssetColumn>
      </div>
    </section>
  );
}

function AssetColumn({
  title,
  emptyText,
  children,
}: {
  readonly title: string;
  readonly emptyText: string;
  readonly children: ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(items) ? items.length === 0 : !items;
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-background/50 p-md">
      <h3 className="font-label text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
        {title}
      </h3>
      <div className="mt-md grid gap-sm">
        {isEmpty ? (
          <p className="rounded-2xl border border-dashed border-outline-variant/30 p-lg font-body text-body-md text-on-surface-variant">
            {emptyText}
          </p>
        ) : (
          items
        )}
      </div>
    </div>
  );
}

function DatasetAssetCard({ dataset }: { readonly dataset: DatasetSummary }) {
  return (
    <Link
      href={buildDatasetDetailHref(dataset.id)}
      className="group rounded-2xl border border-outline-variant/20 bg-surface-container-low p-lg transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-md">
        <div>
          <h4 className="font-h3 text-body-lg font-bold text-on-surface group-hover:text-primary">
            {dataset.title}
          </h4>
          <p className="mt-xs line-clamp-2 font-body text-body-sm text-on-surface-variant">
            {dataset.description || "No description provided."}
          </p>
        </div>
        <span className="rounded-full border border-primary/20 px-3 py-1 font-label text-[10px] uppercase tracking-[0.2em] text-primary">
          {dataset.size.category}
        </span>
      </div>
      <div className="mt-md flex flex-wrap gap-xs">
        {dataset.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-primary/10 px-3 py-1 font-label text-[10px] uppercase tracking-[0.18em] text-primary"
          >
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}

function ModelAssetCard({ model }: { readonly model: ModelSummary }) {
  return (
    <a
      href={model.huggingFaceUrl}
      target="_blank"
      rel="noreferrer"
      className="group rounded-2xl border border-outline-variant/20 bg-surface-container-low p-lg transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-md">
        <div>
          <h4 className="break-words font-h3 text-body-lg font-bold text-on-surface group-hover:text-primary">
            {model.id}
          </h4>
          <p className="mt-xs break-words font-body text-body-sm text-on-surface-variant">
            Base: {model.baseModel}
          </p>
        </div>
        <span className="rounded-full border border-tertiary/25 px-3 py-1 font-label text-[10px] uppercase tracking-[0.2em] text-tertiary">
          {model.trainingMethod}
        </span>
      </div>
      <div className="mt-md grid grid-cols-2 gap-sm font-body text-body-sm text-on-surface-variant">
        <span>{model.trainingDatasetCount} datasets</span>
        <span>{model.pointCost} pts</span>
      </div>
    </a>
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
