export const INITIAL_POINT_BALANCE = 10_000;
export const POINT_BALANCE_STORAGE_KEY = "burstchester:point-balance";
export const POINT_BALANCE_EVENT = "burstchester:point-balance-updated";

export function readCachedPointBalance(storage: Storage | null = getLocalStorage()): number {
  if (!storage) return INITIAL_POINT_BALANCE;
  const value = storage.getItem(POINT_BALANCE_STORAGE_KEY);
  if (value === null) return INITIAL_POINT_BALANCE;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.floor(parsed)
    : INITIAL_POINT_BALANCE;
}

export function writeCachedPointBalance(
  points: number,
  storage: Storage | null = getLocalStorage(),
): number {
  const normalized = Number.isFinite(points) && points >= 0
    ? Math.floor(points)
    : INITIAL_POINT_BALANCE;
  if (storage) {
    storage.setItem(POINT_BALANCE_STORAGE_KEY, String(normalized));
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(POINT_BALANCE_EVENT, {
      detail: { points: normalized },
    }));
  }
  return normalized;
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
