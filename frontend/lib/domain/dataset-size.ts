export type DatasetSizeCategory = "tiny" | "small" | "medium" | "large";

export class DatasetSize {
  private constructor(
    readonly rowCount: number,
    readonly category: DatasetSizeCategory,
  ) {}

  static fromRowCount(rowCount: number): DatasetSize {
    if (!Number.isFinite(rowCount) || rowCount < 0) {
      throw new Error(`rowCount must be a non-negative finite number (got: ${rowCount})`);
    }
    return new DatasetSize(rowCount, classify(rowCount));
  }
}

function classify(rowCount: number): DatasetSizeCategory {
  if (rowCount < 100) return "tiny";
  if (rowCount < 1000) return "small";
  if (rowCount < 10_000) return "medium";
  return "large";
}
