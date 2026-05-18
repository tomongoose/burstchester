import test from "node:test";
import assert from "node:assert/strict";

import {
  parseDatasetIdFile,
  serializeDatasetIds,
} from "../src/lib/dataset-list.mjs";

test("parseDatasetIdFile accepts newline separated dataset ids", () => {
  const ids = parseDatasetIdFile("legal-ko\nfinance-ko\n\nlegal-ko\n");

  assert.deepEqual(ids, ["legal-ko", "finance-ko"]);
});

test("parseDatasetIdFile accepts comma separated dataset ids", () => {
  const ids = parseDatasetIdFile("legal-ko, finance-ko\nlegal-ko\n");

  assert.deepEqual(ids, ["legal-ko", "finance-ko"]);
});

test("parseDatasetIdFile rejects JSONL training records", () => {
  assert.throws(
    () => parseDatasetIdFile('{"messages":[{"role":"user","content":"hello"}]}\n'),
    /not a merged JSONL training file/,
  );
});

test("serializeDatasetIds writes one id per line with trailing newline", () => {
  const text = serializeDatasetIds(["legal-ko", "finance-ko"]);

  assert.equal(text, "legal-ko\nfinance-ko\n");
});
