# CLI Auth Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the CLI start with Firebase anonymous auth, let the user write a profile, then upgrade the same account to Google sign-in and continue with the linked identity.

**Architecture:** Avoid new npm dependencies by using Firebase Auth REST endpoints plus Google device sign-in flow. Add one backend HTTP endpoint that verifies a Firebase ID token and upserts `users/{uid}` so the CLI does not need Firestore SDK access.

**Tech Stack:** Node 20 ESM, existing Firebase Functions backend, Firebase Auth REST API, Google device sign-in flow, built-in `node:test`.

---

### Task 1: Backend profile upsert endpoint

**Files:**
- Create: `backend/test/upsertCliProfile.test.cjs`
- Modify: `backend/src/index.ts`

**Step 1: Write the failing test**

- unauthorized request returns `401`
- valid request writes or merges profile fields and returns profile payload

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL because the handler does not exist yet.

**Step 3: Write minimal implementation**

- add `upsertCliProfile` HTTP endpoint
- verify bearer token with Admin Auth
- create a zero-counter profile when missing
- merge display fields when profile already exists

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

### Task 2: CLI auth library tests

**Files:**
- Create: `cli/test/auth.test.mjs`

**Step 1: Write the failing test**

- anonymous sign-in request builder uses Firebase `accounts:signUp`
- Google link request builder includes current Firebase ID token and `providerId=google.com`
- JWT payload decode extracts email and display name from an ID token

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL because auth helpers do not exist yet.

**Step 3: Write minimal implementation**

- add pure helpers for Firebase REST auth and JWT payload parsing

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

### Task 3: CLI commands and session persistence

**Files:**
- Create: `cli/src/lib/firebase-auth.mjs`
- Create: `cli/src/lib/google-device.mjs`
- Create: `cli/src/lib/profile.mjs`
- Create: `cli/src/lib/session.mjs`
- Modify: `cli/src/cli.mjs`
- Modify: `cli/README.md`

**Step 1: Add command-level tests only where missing**

- cover status output or session save/load behavior if core tests do not already pin it

**Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL

**Step 3: Write minimal implementation**

- persist CLI auth session to disk
- `auth status`
- `auth profile --display-name ... [--photo-url ...]`
- profile command should:
- create anonymous Firebase session if absent
- upsert profile through backend endpoint
- if current session is anonymous, start Google device flow, poll for tokens, link Google credential to the same Firebase user, then upsert profile again with Google-derived fields

**Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: PASS

### Task 4: Verification and docs

**Files:**
- Modify: `backend/README.md`
- Modify: `cli/README.md`

**Step 1: Verify**

Run:

```bash
cd backend && npm test && npm run typecheck
cd cli && npm test
cd frontend && npm test
```

Expected: all green

**Step 2: Document required configuration**

- Firebase Web API key
- backend profile endpoint URL
- Google device client ID and client secret
