import type { ProfileCardData } from "@/components/profile/ProfileCard";

interface AuthProfileUser {
  readonly uid: string;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly photoURL: string | null;
  readonly isAnonymous?: boolean;
}

export function buildProfileCardDataFromAuthUser(
  user: AuthProfileUser,
): ProfileCardData {
  const displayName = user.displayName?.trim()
    || (user.isAnonymous ? "Anonymous" : "Burstchester user");

  return {
    uid: user.uid,
    displayName,
    email: user.email?.trim() || "",
    photoURL: user.photoURL,
    description: "",
    workplace: "",
    uploadCount: 0,
    downloadCount: 0,
    points: 0,
    reputation: 0,
  };
}
