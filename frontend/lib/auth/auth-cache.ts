export interface CachedAuthUser {
  readonly uid: string;
  readonly displayName: string;
  readonly photoURL: string;
}

const STORAGE_KEY = "bc:auth:user";

export function readCachedAuthUser(): CachedAuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedAuthUser> | null;
    if (!parsed || typeof parsed.uid !== "string" || !parsed.uid) return null;
    return {
      uid: parsed.uid,
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : "",
      photoURL: typeof parsed.photoURL === "string" ? parsed.photoURL : "",
    };
  } catch {
    return null;
  }
}

export function writeCachedAuthUser(user: CachedAuthUser): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // localStorage may be unavailable (private mode, quota); cache is best-effort.
  }
}

export function clearCachedAuthUser(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort.
  }
}
