export const INITIAL_USER_POINTS = 10_000;
export const DEFAULT_DATASET_DOWNLOAD_POINT_COST = 10;
export const DEFAULT_MODEL_DOWNLOAD_POINT_COST = 100;
export const CREATOR_PAYOUT_RATE = 0.7;

export interface PointChargeResult {
  readonly pointCost: number;
  readonly remainingPoints: number;
}

export function normalizePointCost(
  value: unknown,
  fallback: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

export function applyPointCharge(
  currentPoints: number,
  pointCost: number,
): PointChargeResult {
  if (currentPoints < pointCost) {
    throw new Error("Insufficient points.");
  }
  return Object.freeze({
    pointCost,
    remainingPoints: currentPoints - pointCost,
  });
}

export function calculateCreatorPayout(pointCost: number): number {
  if (!Number.isFinite(pointCost) || pointCost <= 0) return 0;
  return Math.floor(pointCost * CREATOR_PAYOUT_RATE);
}

export function encodePurchaseKey(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function paidDatasetPath(uid: string, datasetId: string): string {
  return `paidDownloads/${uid}/datasets/${encodePurchaseKey(datasetId)}`;
}

export function paidModelPath(uid: string, modelName: string): string {
  return `paidDownloads/${uid}/models/${encodePurchaseKey(modelName)}`;
}
