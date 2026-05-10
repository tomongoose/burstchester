import { Timestamp } from "firebase-admin/firestore";
import { INITIAL_USER_POINTS } from "./purchases";

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
  readonly description: string;
  readonly workplace: string;
  readonly createdAt: Timestamp;
  readonly uploadCount: number;
  readonly downloadCount: number;
  readonly points: number;
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
    description: "",
    workplace: "",
    createdAt: now,
    uploadCount: 0,
    downloadCount: 0,
    points: INITIAL_USER_POINTS,
    reputation: 0,
  });
}
