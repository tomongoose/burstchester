export function serializeSelectedDatasetIds(datasetIds: readonly string[]): string {
  const normalized: string[] = [];

  for (const datasetId of datasetIds) {
    const trimmed = datasetId.trim();
    if (!trimmed || normalized.includes(trimmed)) continue;
    normalized.push(trimmed);
  }

  return normalized.length > 0 ? `${normalized.join("\n")}\n` : "";
}
