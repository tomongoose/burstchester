import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;
const PROJECT_ID = "burstchester-rules-users";

const VALID_PROFILE = {
  uid: "u-alice",
  displayName: "Alice",
  email: "alice@example.com",
  photoURL: null,
  uploadCount: 0,
  downloadCount: 0,
  reputation: 0,
  createdAt: new Date("2026-05-05T12:00:00Z"),
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(join(__dirname, "../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("firestore.rules — users collection", () => {
  it("allows anyone (unauthenticated) to read a user profile", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/u-alice"), VALID_PROFILE);
    });

    const ctx = testEnv.unauthenticatedContext();
    await assertSucceeds(getDoc(doc(ctx.firestore(), "users/u-alice")));
  });

  it("rejects unauthenticated profile creation", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(setDoc(doc(ctx.firestore(), "users/u-alice"), VALID_PROFILE));
  });

  it("allows authenticated owner to create own profile with valid shape", async () => {
    const ctx = testEnv.authenticatedContext("u-alice");
    await assertSucceeds(setDoc(doc(ctx.firestore(), "users/u-alice"), VALID_PROFILE));
  });

  it("rejects creating profile when data.uid does not match path uid", async () => {
    const ctx = testEnv.authenticatedContext("u-alice");
    await assertFails(
      setDoc(doc(ctx.firestore(), "users/u-alice"), {
        ...VALID_PROFILE,
        uid: "u-someone-else",
      }),
    );
  });

  it("rejects creating profile with non-zero uploadCount", async () => {
    const ctx = testEnv.authenticatedContext("u-alice");
    await assertFails(
      setDoc(doc(ctx.firestore(), "users/u-alice"), {
        ...VALID_PROFILE,
        uploadCount: 100,
      }),
    );
  });

  it("rejects owner trying to modify counters via update", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/u-alice"), VALID_PROFILE);
    });

    const ctx = testEnv.authenticatedContext("u-alice");
    await assertFails(
      updateDoc(doc(ctx.firestore(), "users/u-alice"), { uploadCount: 5 }),
    );
  });

  it("rejects user updating someone else's profile", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/u-alice"), VALID_PROFILE);
    });

    const intruder = testEnv.authenticatedContext("u-mallory");
    await assertFails(
      updateDoc(doc(intruder.firestore(), "users/u-alice"), {
        displayName: "Hacked",
      }),
    );
  });
});
