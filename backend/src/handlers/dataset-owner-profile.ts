import type { HandlerDeps } from "./deps";

export interface DatasetOwnerProfile {
  readonly displayName: string;
  readonly photoURL: string;
}

export async function readDatasetOwnerProfiles(
  deps: Pick<HandlerDeps, "db">,
  ownerUids: readonly string[],
): Promise<ReadonlyMap<string, DatasetOwnerProfile>> {
  const db = (deps as { readonly db?: HandlerDeps["db"] }).db;
  if (!db) return new Map();

  const uniqueOwnerUids = [...new Set(ownerUids.filter(Boolean))];
  const entries = await Promise.all(
    uniqueOwnerUids.map(async (uid) => {
      try {
        const snapshot = await db.doc(`users/${uid}`).get();
        const data = snapshot.exists ? snapshot.data() : null;
        return [
          uid,
          {
            displayName: normalizeDisplayName(data?.displayName),
            photoURL: normalizePhotoURL(data?.photoURL),
          },
        ] as const;
      } catch {
        return [uid, { displayName: "", photoURL: "" }] as const;
      }
    }),
  );

  return new Map(entries);
}

function normalizeDisplayName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhotoURL(value: unknown): string {
  const photoURL = typeof value === "string" ? value.trim() : "";
  return photoURL.startsWith("https://") ? photoURL : "";
}
