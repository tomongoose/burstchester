import type { JSX } from "react";

export interface ProfileCardData {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly photoURL: string | null;
  readonly uploadCount: number;
  readonly downloadCount: number;
  readonly reputation: number;
}

interface ProfileCardProps {
  readonly profile: ProfileCardData;
}

export function ProfileCard({ profile }: ProfileCardProps): JSX.Element {
  return (
    <div>
      {profile.photoURL ? (
        <img src={profile.photoURL} alt={`${profile.displayName} avatar`} />
      ) : (
        <div data-testid="avatar-fallback">{profile.displayName.charAt(0).toUpperCase()}</div>
      )}
      <div>{profile.displayName}</div>
      <div>{profile.email}</div>
      <div>{profile.uploadCount} datasets uploaded</div>
      <div>{profile.downloadCount} datasets downloaded</div>
    </div>
  );
}
