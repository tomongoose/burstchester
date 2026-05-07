import test from "node:test";
import assert from "node:assert/strict";

import {
  addDatasetId,
  clearDatasetIds,
  normalizeDatasetId,
  removeDatasetId,
} from "../src/lib/session.mjs";

test("normalizeDatasetId trims values and rejects blanks", () => {
  assert.equal(normalizeDatasetId("  legal-ko  "), "legal-ko");
  assert.equal(normalizeDatasetId("   "), null);
});

test("addDatasetId appends unique dataset ids", () => {
  const ids = addDatasetId(["dataset-1"], " dataset-2 ");

  assert.deepEqual(ids, ["dataset-1", "dataset-2"]);
  assert.deepEqual(addDatasetId(ids, "dataset-2"), ["dataset-1", "dataset-2"]);
});

test("removeDatasetId and clearDatasetIds update the list predictably", () => {
  const ids = ["dataset-1", "dataset-2", "dataset-3"];

  assert.deepEqual(removeDatasetId(ids, "dataset-2"), ["dataset-1", "dataset-3"]);
  assert.deepEqual(clearDatasetIds(ids), []);
});
