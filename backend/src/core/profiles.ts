import { Timestamp } from "firebase-admin/firestore";

export interface AuthProfileInput {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

export interface UserProfileRecord {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: Timestamp;
  uploadCount: number;
  downloadCount: number;
  reputation: number;
}

export function buildUserProfile(user: AuthProfileInput): UserProfileRecord {
  return {
    uid: user.uid,
    displayName: user.displayName ?? "Anonymous",
    email: user.email ?? "",
    photoURL: user.photoURL ?? "",
    createdAt: Timestamp.now(),
    uploadCount: 0,
    downloadCount: 0,
    reputation: 0,
  };
}
