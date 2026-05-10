import type { JSX } from "react";

export interface ProfileCardData {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly photoURL: string | null;
  readonly description: string;
  readonly workplace: string;
  readonly uploadCount: number;
  readonly downloadCount: number;
  readonly points: number;
  readonly reputation: number;
}

interface ProfileCardProps {
  readonly profile: ProfileCardData;
}

export function ProfileCard({
  profile,
}: ProfileCardProps): JSX.Element {
  return (
    <section className="rounded-lg border border-outline-variant/25 bg-surface-container-low p-lg">
      <div className="grid gap-lg">
        <div className="flex flex-col gap-md sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-md sm:flex-row sm:items-center">
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={`${profile.displayName} avatar`}
                className="h-20 w-20 shrink-0 rounded-full border-2 border-outline-variant/30 object-cover"
              />
            ) : (
              <div
                data-testid="avatar-fallback"
                className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-2 border-outline-variant/30 bg-primary-container font-h1 text-h2 font-bold text-on-primary-container"
              >
                {profile.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="break-words font-h1 text-h2 text-on-surface">
                {profile.displayName}
              </h2>
              {profile.email ? (
                <p className="break-all font-body text-body-sm text-on-surface-variant">
                  {profile.email}
                </p>
              ) : null}
              {profile.workplace ? (
                <p className="mt-xs break-words font-label text-label uppercase tracking-widest text-primary">
                  {profile.workplace}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {profile.description ? (
          <p className="max-w-3xl break-words font-body text-body-md text-on-surface-variant">
            {profile.description}
          </p>
        ) : null}

        <dl className="grid grid-cols-1 gap-sm sm:grid-cols-3">
          <Stat label="Uploads" value={profile.uploadCount} icon="upload" />
          <Stat
            label="Downloads"
            value={profile.downloadCount}
            icon="download"
          />
          <Stat label="Reputation" value={profile.reputation} icon="bolt" />
        </dl>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  readonly label: string;
  readonly value: number;
  readonly icon: string;
}) {
  return (
    <div className="rounded-lg border border-outline-variant/20 bg-background/45 p-md">
      <div className="flex items-center gap-sm font-label text-label uppercase tracking-widest text-on-surface-variant">
        <span className="material-symbols-outlined text-base text-primary">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-sm font-h1 text-h2 font-bold text-on-surface">
        {value.toLocaleString()}
      </div>
    </div>
  );
}
