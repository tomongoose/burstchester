export function buildDatasetDetailHref(datasetId: string): string {
  const params = new URLSearchParams({ dataset: datasetId });
  return `/datasets?${params.toString()}`;
}
