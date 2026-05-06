import test from "node:test";
import assert from "node:assert/strict";

import { buildTrainingCommand, buildTrainingManifest } from "../src/lib/train.mjs";

test("buildTrainingManifest keeps core training metadata", () => {
  const manifest = buildTrainingManifest({
    datasetId: "dataset-1",
    datasetIds: ["dataset-1", "dataset-2"],
    datasetPath: "/tmp/dataset.jsonl",
    modelRepo: "Qwen/Qwen3-0.6B",
    outputDir: "/tmp/out",
    trainingMethod: "qlora",
  });

  assert.equal(manifest.datasetId, "dataset-1");
  assert.deepEqual(manifest.datasetIds, ["dataset-1", "dataset-2"]);
  assert.equal(manifest.datasetPath, "/tmp/dataset.jsonl");
  assert.equal(manifest.modelRepo, "Qwen/Qwen3-0.6B");
  assert.equal(manifest.outputDir, "/tmp/out");
  assert.equal(manifest.trainingMethod, "qlora");
});

test("buildTrainingCommand points at the bundled python trainer", () => {
  const command = buildTrainingCommand({
    pythonBin: "python3",
    scriptPath: "/workspace/cli/src/python/train.py",
    configPath: "/tmp/train-config.json",
  });

  assert.deepEqual(command, [
    "python3",
    "/workspace/cli/src/python/train.py",
    "--config",
    "/tmp/train-config.json",
  ]);
});
