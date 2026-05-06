# CLI Dataset List Training Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a CLI-managed dataset ID list that can be reused for fine-tuning by downloading each dataset package from the backend and training a Hugging Face model on the merged data.

**Architecture:** Persist a dataset ID list in the existing CLI session file. Add commands to add, remove, list, and clear dataset IDs. Extend `train` so it can resolve dataset IDs from the stored list, download each package through `prepareDatasetDownload`, extract `dataset.jsonl`, merge them into one local JSONL file, and then call the existing Python trainer with that merged path.

**Tech Stack:** Node 20 ESM CLI, existing backend HTTP dataset download endpoint, built-in `node:test`, existing Python training runner.

---

### Task 1: Dataset list persistence tests

**Files:**
- Create: `cli/test/dataset-list.test.mjs`
- Modify: `cli/src/lib/session.mjs`

**Step 1: Write the failing test**

- normalize and deduplicate dataset IDs
- add/remove/clear operations return the expected list

**Step 2: Run test to verify it fails**

Run: `cd cli && npm test`

Expected: FAIL because dataset list helpers do not exist yet.

**Step 3: Write minimal implementation**

- add pure helpers for dataset list normalization and mutation

**Step 4: Run test to verify it passes**

Run: `cd cli && npm test`

Expected: PASS

### Task 2: Training manifest tests

**Files:**
- Modify: `cli/test/train.test.mjs`
- Modify: `cli/src/lib/train.mjs`

**Step 1: Write the failing test**

- training manifest includes `datasetIds`
- merged dataset path is preserved

**Step 2: Run test to verify it fails**

Run: `cd cli && npm test`

Expected: FAIL because manifest does not include the new shape yet.

**Step 3: Write minimal implementation**

- extend manifest to include dataset list metadata

**Step 4: Run test to verify it passes**

Run: `cd cli && npm test`

Expected: PASS

### Task 3: CLI commands and multi-dataset download

**Files:**
- Modify: `cli/src/cli.mjs`
- Modify: `cli/src/lib/backend.mjs`
- Modify: `cli/src/lib/download.mjs`
- Modify: `cli/README.md`

**Step 1: Add command surface**

- `dataset-list add --dataset-id <id>`
- `dataset-list remove --dataset-id <id>`
- `dataset-list show`
- `dataset-list clear`

**Step 2: Extend train flow**

- if `--dataset-id` is provided, use that single dataset
- otherwise use the stored dataset list
- download each dataset ZIP
- extract `dataset.jsonl`
- merge all normalized JSONL files into one local `merged-dataset.jsonl`
- pass merged path plus `datasetIds` to the trainer manifest

**Step 3: Verify**

Run:

```bash
cd cli && npm test
```

Expected: PASS
