# Gemma4 E2B Full Fine-Tuning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated CLI and Python path for full fine-tuning `google/gemma-4-E2B` on stored dataset IDs or a supplied dataset ID.

**Architecture:** Keep the existing generic trainer as the core execution engine, but refactor it to expose reusable Python entry points. Add a dedicated Gemma4 full fine-tuning wrapper that pins the model repo and `trainingMethod=full`, and add a CLI command that reuses the dataset-list merge flow before invoking that wrapper.

**Tech Stack:** Node 20 ESM CLI, Python 3 trainer, Hugging Face Transformers, existing backend dataset download endpoint.

---

### Task 1: CLI tests for Gemma4 full manifest

**Files:**
- Modify: `cli/test/train.test.mjs`

**Step 1: Write the failing test**

- a helper should build a Gemma4 E2B full fine-tuning manifest with `modelRepo=google/gemma-4-E2B`
- `trainingMethod` must be `full`

**Step 2: Run test to verify it fails**

Run: `cd cli && npm test`

Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

- add a manifest builder for Gemma4 full FT

**Step 4: Run test to verify it passes**

Run: `cd cli && npm test`

Expected: PASS

### Task 2: Python trainer refactor

**Files:**
- Modify: `cli/src/python/train.py`
- Create: `cli/src/python/train_gemma4_e2b_full.py`

**Step 1: Keep generic training logic reusable**

- expose a Python function that trains from a config dict

**Step 2: Add Gemma4 wrapper**

- wrapper should set `modelRepo=google/gemma-4-E2B`
- wrapper should force `trainingMethod=full`

**Step 3: Verify syntax**

Run:

```bash
cd cli && PYTHONPYCACHEPREFIX=/private/tmp python3 -m py_compile src/python/train.py src/python/train_gemma4_e2b_full.py
```

Expected: PASS

### Task 3: CLI command and execution attempt

**Files:**
- Modify: `cli/src/cli.mjs`
- Modify: `cli/README.md`

**Step 1: Add command**

- `train-gemma4-e2b-full`

**Step 2: Reuse dataset merge flow**

- if `--dataset-id` exists use that
- otherwise use stored dataset list
- run preflight
- merge downloaded `dataset.jsonl` files
- invoke the Gemma4 wrapper script

**Step 3: Attempt execution**

- if runtime dependencies or hardware are missing, capture the exact blocker

**Step 4: Verify JS tests**

Run:

```bash
cd cli && npm test
```

Expected: PASS
