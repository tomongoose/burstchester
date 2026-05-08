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
  readonly reputation: number;
}

interface ProfileCardProps {
  readonly profile: ProfileCardData;
  readonly editable?: boolean;
  readonly onEdit?: () => void;
}

export function ProfileCard({
  profile,
  editable = false,
  onEdit,
}: ProfileCardProps): JSX.Element {
  return (
    <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container">
      <div className="relative h-32 bg-gradient-to-br from-primary-container/20 via-surface-container-high to-surface-container">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.18),transparent_70%)]" />
      </div>
      <div className="-mt-12 px-xl pb-xl">
        <div className="flex flex-wrap items-end gap-lg">
          {profile.photoURL ? (
            <img
              src={profile.photoURL}
              alt={`${profile.displayName} avatar`}
              className="h-24 w-24 rounded-full border-4 border-surface-container object-cover"
            />
          ) : (
            <div
              data-testid="avatar-fallback"
              className="grid h-24 w-24 place-items-center rounded-full border-4 border-surface-container bg-primary-container font-h1 text-h2 font-bold text-on-primary-container"
            >
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-md">
              <div>
                <h1 className="font-h1 text-h2 text-on-surface">
                  {profile.displayName}
                </h1>
                {profile.email ? (
                  <p className="font-body text-body-md text-on-surface-variant">
                    {profile.email}
                  </p>
                ) : null}
              </div>
              {editable ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="rounded-xl bg-primary px-lg py-3 font-body text-body-md font-bold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!onEdit}
                >
                  Edit profile
                </button>
              ) : null}
            </div>
            {profile.workplace ? (
              <p className="mt-xs font-label text-label uppercase tracking-widest text-primary">
                {profile.workplace}
              </p>
            ) : null}
          </div>
        </div>

        {profile.description ? (
          <p className="mt-lg max-w-3xl font-body text-body-md text-on-surface-variant">
            {profile.description}
          </p>
        ) : null}

        <dl className="mt-xl grid grid-cols-1 gap-md sm:grid-cols-3">
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
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-lg">
      <div className="flex items-center gap-sm font-label text-label uppercase tracking-widest text-on-surface-variant">
        <span className="material-symbols-outlined text-base text-primary">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-sm font-h1 text-h1 font-bold text-on-surface">
        {value.toLocaleString()}
      </div>
    </div>
  );
}
