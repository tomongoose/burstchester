# CLI Hugging Face Token Storage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a CLI feature that accepts a Hugging Face token locally, stores it for later use, and automatically reuses it for model downloads.

**Architecture:** Reuse the existing CLI session file under `~/.burstchester/session.json` to hold a `huggingFaceToken` value. Add an `auth huggingface` command that stores or clears the token, and change `download-model` to resolve its token from explicit input first, then the stored session token, then environment variables.

**Tech Stack:** Node 20 ESM CLI, built-in `node:test`, existing local session persistence.

---

### Task 1: Token resolution tests

**Files:**
- Create: `cli/test/huggingface-token.test.mjs`
- Modify: `cli/src/lib/huggingface.mjs`

**Step 1: Write the failing test**

- stored session token is used when explicit token is absent
- explicit token overrides stored and env tokens
- blank token input normalizes to null

**Step 2: Run test to verify it fails**

Run: `cd cli && npm test`

Expected: FAIL because token resolution helpers do not exist yet.

**Step 3: Write minimal implementation**

- add pure helpers for Hugging Face token normalization and precedence

**Step 4: Run test to verify it passes**

Run: `cd cli && npm test`

Expected: PASS

### Task 2: CLI session command

**Files:**
- Modify: `cli/src/cli.mjs`
- Modify: `cli/src/lib/session.mjs`
- Modify: `cli/README.md`

**Step 1: Add failing command-path test if needed**

- only if pure helper coverage is insufficient

**Step 2: Implement minimal command**

- `auth huggingface --token <value>`
- `auth huggingface --clear`
- if `--token` is omitted, prompt on stdin and store the result

**Step 3: Wire downloads**

- `download-model` loads session and passes stored token to `downloadHuggingFaceFile`

**Step 4: Verify**

Run:

```bash
cd cli && npm test
```

Expected: PASS
