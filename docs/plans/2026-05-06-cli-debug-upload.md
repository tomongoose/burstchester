# CLI Debug Dataset Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a CLI command that uploads local JSONL test data to the backend for debugging and creates a real `datasets/{id}` record through the existing validation pipeline.

**Architecture:** Expose a debug-only HTTP endpoint on the backend that accepts authenticated JSON payloads containing JSONL content plus lightweight metadata. Reuse `processDatasetUpload` so validation, normalization, Firestore writes, and Storage outputs stay aligned with the existing upload path.

**Tech Stack:** Firebase Functions backend, existing dataset core logic, Node 20 ESM CLI, built-in `node:test`.

---

### Task 1: Backend debug upload handler

**Files:**
- Create: `backend/test/debugUploadDataset.test.cjs`
- Modify: `backend/src/index.ts`

**Step 1: Write the failing test**

- reject requests without bearer token
- accept JSONL content and return dataset metadata from the reused upload flow

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test`

Expected: FAIL because the handler does not exist yet.

**Step 3: Write minimal implementation**

- add `debugUploadDataset` `onRequest` endpoint
- verify Firebase ID token
- derive owner metadata from token
- save original JSONL to Storage
- call `processDatasetUpload` with the same normalization/upsert dependencies as the real trigger

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test`

Expected: PASS

### Task 2: CLI request builder

**Files:**
- Create: `cli/test/debug-upload.test.mjs`
- Modify: `cli/src/lib/backend.mjs`

**Step 1: Write the failing test**

- build authenticated POST request for debug upload
- include content and metadata in JSON body

**Step 2: Run test to verify it fails**

Run: `cd cli && npm test`

Expected: FAIL because helper does not exist yet.

**Step 3: Write minimal implementation**

- add backend helper to POST debug upload payload

**Step 4: Run test to verify it passes**

Run: `cd cli && npm test`

Expected: PASS

### Task 3: CLI command

**Files:**
- Modify: `cli/src/cli.mjs`
- Modify: `cli/src/lib/default-config.mjs`
- Modify: `cli/README.md`

**Step 1: Add command wiring**

- `upload-test-dataset --file <path> [--dataset-id <id>] [--title <title>]`

**Step 2: Implement minimal behavior**

- load or refresh current session
- read local JSONL file
- POST to backend debug upload endpoint
- print created dataset metadata

**Step 3: Verify**

Run:

```bash
cd backend && npm run typecheck && npm test
cd cli && npm test
```

Expected: all green
