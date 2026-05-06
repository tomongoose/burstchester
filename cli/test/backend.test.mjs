import test from "node:test";
import assert from "node:assert/strict";

import { buildDatasetDownloadUrl } from "../src/lib/backend.mjs";

test("buildDatasetDownloadUrl appends datasetId query parameter", () => {
  const url = buildDatasetDownloadUrl(
    "https://us-central1-demo.cloudfunctions.net/prepareDatasetDownload",
    "dataset-1",
  );

  assert.equal(
    url,
    "https://us-central1-demo.cloudfunctions.net/prepareDatasetDownload?datasetId=dataset-1",
  );
});
