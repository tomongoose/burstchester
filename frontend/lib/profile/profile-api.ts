import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { resolveDatasetBackendBaseUrl } from "@/lib/datasets/list-datasets";
import { getFirebaseStorage } from "@/lib/firebase";

export interface EditableProfileUser {
  readonly uid: string;
  readonly getIdToken: () => Promise<string>;
}

export interface UserProfile {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly photoURL: string;
  readonly description: string;
  readonly workplace: string;
  readonly uploadCount: number;
  readonly downloadCount: number;
  readonly reputation: number;
}

interface ProfileResponse {
  readonly ok?: boolean;
  readonly profile?: UserProfile;
  readonly error?: string;
}

export async function fetchMyProfile({
  user,
  uid,
  endpointUrl = resolveProfileUrl(),
  fetchImpl = fetch,
}: {
  readonly user: EditableProfileUser;
  readonly uid?: string;
  readonly endpointUrl?: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<UserProfile> {
  const idToken = await user.getIdToken();
  const url = new URL(endpointUrl);
  if (uid) url.searchParams.set("uid", uid);
  const response = await fetchImpl(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: "application/json",
    },
  });

  const payload = (await response.json()) as ProfileResponse;
  if (!response.ok || !payload.ok || !payload.profile) {
    throw new Error(payload.error || `Profile request failed with status ${response.status}.`);
  }
  return payload.profile;
}

export async function saveMyProfile({
  user,
  profile,
  endpointUrl = resolveProfileUrl(),
  fetchImpl = fetch,
}: {
  readonly user: EditableProfileUser;
  readonly profile: Pick<UserProfile, "displayName" | "description" | "workplace" | "photoURL">;
  readonly endpointUrl?: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<UserProfile> {
  const idToken = await user.getIdToken();
  const response = await fetchImpl(endpointUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(profile),
  });

  const payload = (await response.json()) as ProfileResponse;
  if (!response.ok || !payload.ok || !payload.profile) {
    throw new Error(payload.error || `Profile save failed with status ${response.status}.`);
  }
  return payload.profile;
}

export async function uploadProfilePhoto({
  user,
  file,
  storage = getFirebaseStorage(),
}: {
  readonly user: EditableProfileUser;
  readonly file: File;
  readonly storage?: ReturnType<typeof getFirebaseStorage>;
}): Promise<string> {
  const extension = file.name.split(".").pop()?.replace(/[^A-Za-z0-9]/g, "") || "bin";
  const objectRef = ref(
    storage,
    `users/${user.uid}/profile/avatar-${Date.now()}.${extension}`,
  );
  await uploadBytes(objectRef, file, { contentType: file.type || "application/octet-stream" });
  return getDownloadURL(objectRef);
}

export function resolveProfileUrl(): string {
  return `${resolveDatasetBackendBaseUrl()}/upsertCliProfile`;
}
