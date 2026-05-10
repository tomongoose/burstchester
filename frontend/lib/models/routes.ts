export const MODEL_DETAIL_ANCHOR = "model-detail";

export function buildModelDetailHref(modelId: string): string {
  const params = new URLSearchParams({
    asset: "models",
    model: modelId,
  });
  return `/datasets?${params.toString()}#${MODEL_DETAIL_ANCHOR}`;
}
