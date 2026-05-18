import test from "node:test";
import assert from "node:assert/strict";

import { parseArgs } from "../src/lib/args.mjs";

test("parseArgs preserves repeated flags as arrays", () => {
  const { flags } = parseArgs([
    "register-model",
    "--dataset-id",
    "dataset-1",
    "--dataset-id",
    "dataset-2",
  ]);

  assert.deepEqual(flags["dataset-id"], ["dataset-1", "dataset-2"]);
});
