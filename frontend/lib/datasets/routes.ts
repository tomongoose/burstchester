export const DATASET_DETAIL_ANCHOR = "dataset-detail";

export function buildDatasetDetailHref(datasetId: string): string {
  const params = new URLSearchParams({ dataset: datasetId });
  return `/datasets?${params.toString()}#${DATASET_DETAIL_ANCHOR}`;
}
