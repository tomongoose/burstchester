import { Timestamp } from "firebase-admin/firestore";

export interface AuthProfileInput {
  readonly uid: string;
  readonly displayName?: string | null;
  readonly email?: string | null;
  readonly photoURL?: string | null;
}

export interface UserProfileRecord {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly photoURL: string;
  readonly createdAt: Timestamp;
  readonly uploadCount: number;
  readonly downloadCount: number;
  readonly reputation: number;
}

export function buildUserProfile(
  user: AuthProfileInput,
  now: Timestamp,
): UserProfileRecord {
  return Object.freeze({
    uid: user.uid,
    displayName: user.displayName ?? "Anonymous",
    email: user.email ?? "",
    photoURL: user.photoURL ?? "",
    createdAt: now,
    uploadCount: 0,
    downloadCount: 0,
    reputation: 0,
  });
}
