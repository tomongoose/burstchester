import { UserProfile } from "@/lib/domain/user";

export interface AuthUser {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly photoURL: string | null;
}

export interface InitialProfileDoc {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly photoURL: string | null;
  readonly uploadCount: number;
  readonly downloadCount: number;
  readonly reputation: number;
  readonly createdAt: Date;
}

export function buildInitialProfileDoc(
  authUser: AuthUser,
  now: Date,
): InitialProfileDoc {
  const profile = UserProfile.create(
    authUser.displayName,
    authUser.email,
    authUser.photoURL,
  );
  return Object.freeze({
    uid: authUser.uid,
    displayName: profile.displayName,
    email: profile.email,
    photoURL: profile.photoURL,
    uploadCount: 0,
    downloadCount: 0,
    reputation: 0,
    createdAt: now,
  });
}
