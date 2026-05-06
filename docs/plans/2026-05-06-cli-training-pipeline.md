# CLI Training Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `cli/` workspace that can download a dataset package from the backend, download a model artifact from Hugging Face, and run a local fine-tuning workflow.

**Architecture:** Keep the new CLI dependency-light by using Node 20 built-ins for HTTP, filesystem, ZIP parsing, and process execution. Extend the backend with a plain HTTP endpoint that reuses the existing download packaging core so the CLI can fetch dataset packages without depending on the Firebase web SDK callable protocol.

**Tech Stack:** Node 20 ESM, built-in `node:test`, Python 3 subprocess execution, existing Firebase Functions backend.

---

### Task 1: Backend HTTP download endpoint

**Files:**
- Create: `backend/test/prepareDatasetDownload.test.cjs`
- Modify: `backend/src/index.ts`

**Step 1: Write the failing test**

- Add a unit test for an exported HTTP handler that:
- returns `400` when `datasetId` is missing
- returns `200` and the `prepareDownloadCore` payload when deps succeed

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern prepareDatasetDownload`

Expected: FAIL because the handler does not exist yet.

**Step 3: Write minimal implementation**

- Export an HTTP handler for dataset download requests.
- Parse `datasetId` from query string or JSON body.
- Reuse existing download packaging dependencies and return JSON.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern prepareDatasetDownload`

Expected: PASS

### Task 2: CLI core tests

**Files:**
- Create: `cli/test/backend.test.mjs`
- Create: `cli/test/huggingface.test.mjs`
- Create: `cli/test/zip.test.mjs`
- Create: `cli/test/train.test.mjs`

**Step 1: Write the failing tests**

- backend client builds dataset download URLs and validates JSON responses
- Hugging Face helper builds `resolve/main` URLs correctly
- ZIP reader extracts stored entries needed for `dataset.jsonl`
- training runner builds the Python invocation and manifest correctly

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL because the CLI modules do not exist yet.

**Step 3: Write minimal implementation**

- Add the CLI modules with the exact APIs exercised by the tests.

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

### Task 3: CLI commands and Python trainer

**Files:**
- Create: `cli/package.json`
- Create: `cli/src/cli.mjs`
- Create: `cli/src/lib/args.mjs`
- Create: `cli/src/lib/backend.mjs`
- Create: `cli/src/lib/download.mjs`
- Create: `cli/src/lib/huggingface.mjs`
- Create: `cli/src/lib/train.mjs`
- Create: `cli/src/lib/zip.mjs`
- Create: `cli/src/python/train.py`
- Create: `cli/README.md`

**Step 1: Write the failing command-level tests if needed**

- Add small tests only for behaviors not already covered by Task 2.

**Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL

**Step 3: Write minimal implementation**

- `download-dataset`: call backend HTTP endpoint, download ZIP, optionally extract dataset files
- `download-model`: download a Hugging Face file from `--url` or `--repo` + `--file`
- `train`: download dataset package, optionally stage output dirs, emit a JSON manifest, run the Python trainer
- Python trainer: load normalized JSONL, render chat text, fine-tune with `transformers`; support `full`, `lora`, `qlora` with clear dependency errors

**Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: PASS

### Task 4: End-to-end verification and docs

**Files:**
- Modify: `backend/README.md`
- Create or modify: `cli/README.md`

**Step 1: Verify locally**

Run:

```bash
cd backend && npm test && npm run typecheck
cd cli && npm test
```

Expected: all green

**Step 2: Document usage**

- Add backend README note for the new HTTP download endpoint.
- Document CLI env vars, commands, and Python training prerequisites.
