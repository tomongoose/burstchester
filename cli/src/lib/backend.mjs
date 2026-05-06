export function buildDatasetDownloadUrl(endpointUrl, datasetId) {
  const url = new URL(endpointUrl);
  url.searchParams.set("datasetId", datasetId);
  return url.toString();
}

export function summarizeDatasetPreflight(results) {
  const okDatasetIds = results.filter((result) => result.ok).map((result) => result.datasetId);
  const failedDatasetIds = results.filter((result) => !result.ok).map((result) => result.datasetId);

  return {
    okDatasetIds,
    failedDatasetIds,
    okCount: okDatasetIds.length,
    failedCount: failedDatasetIds.length,
  };
}

export function buildDebugUploadRequest({
  endpointUrl,
  idToken,
  filename,
  content,
  metadata = {},
}) {
  return {
    url: endpointUrl,
    options: {
      method: "POST",
      headers: {
        authorization: `Bearer ${idToken}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        filename,
        content,
        ...metadata,
      }),
    },
  };
}

export async function fetchDatasetPackageMetadata({
  endpointUrl,
  datasetId,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(buildDatasetDownloadUrl(endpointUrl, datasetId), {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  });

  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Dataset download request failed with status ${response.status}.`);
  }

  if (typeof payload.url !== "string" || !payload.url) {
    throw new Error("Dataset download response did not include a signed url.");
  }

  return payload;
}

export async function uploadDebugDataset({
  endpointUrl,
  idToken,
  filename,
  content,
  metadata = {},
  fetchImpl = fetch,
}) {
  const request = buildDebugUploadRequest({
    endpointUrl,
    idToken,
    filename,
    content,
    metadata,
  });

  const response = await fetchImpl(request.url, request.options);
  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Debug dataset upload failed with status ${response.status}.`);
  }

  return payload.dataset;
}

export async function preflightDatasetDownloads({
  endpointUrl,
  datasetIds,
  fetchImpl = fetch,
}) {
  const results = [];

  for (const datasetId of datasetIds) {
    try {
      const payload = await fetchDatasetPackageMetadata({
        endpointUrl,
        datasetId,
        fetchImpl,
      });
      results.push({
        datasetId,
        ok: true,
        zipPath: payload.zipPath,
        cached: payload.cached,
      });
    } catch (error) {
      results.push({
        datasetId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    results,
    summary: summarizeDatasetPreflight(results),
  };
}
