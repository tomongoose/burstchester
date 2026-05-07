export type DatasetStatus =
  | "pending_review"
  | "active"
  | "flagged"
  | "rejected"
  | "removed";

const ALL_STATUSES: ReadonlySet<DatasetStatus> = new Set<DatasetStatus>([
  "pending_review",
  "active",
  "flagged",
  "rejected",
  "removed",
]);

const TRANSITIONS: ReadonlyMap<DatasetStatus, ReadonlySet<DatasetStatus>> = new Map([
  ["pending_review", new Set<DatasetStatus>(["pending_review", "active", "flagged", "rejected", "removed"])],
  ["active", new Set<DatasetStatus>(["active", "flagged", "removed"])],
  ["flagged", new Set<DatasetStatus>(["flagged", "active", "removed"])],
  ["rejected", new Set<DatasetStatus>(["rejected", "removed"])],
  ["removed", new Set<DatasetStatus>(["removed"])],
]);

export function transitionStatus(
  current: DatasetStatus,
  target: DatasetStatus,
): DatasetStatus {
  if (!ALL_STATUSES.has(current)) {
    throw new Error(`Unknown current status: ${current}`);
  }
  if (!ALL_STATUSES.has(target)) {
    throw new Error(`Unknown target status: ${target}`);
  }
  if (current === target) {
    return current;
  }
  const allowed = TRANSITIONS.get(current);
  if (!allowed?.has(target)) {
    throw new Error(`Invalid status transition: ${current} → ${target}`);
  }
  return target;
}

export function tryTransitionStatus(
  current: DatasetStatus,
  target: DatasetStatus,
): DatasetStatus {
  try {
    return transitionStatus(current, target);
  } catch {
    return current;
  }
}
