import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;
const PROJECT_ID = "burstchester-rules-test";

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

describe("firestore.rules — datasets collection", () => {
  it("rejects unauthenticated dataset creation", async () => {
    const ctx = testEnv.unauthenticatedContext();
    const ref = doc(ctx.firestore(), "datasets/d1");
    await assertFails(
      setDoc(ref, {
        ownerUid: "u1",
        title: "x",
        tags: [],
        likeCount: 0,
        downloadCount: 0,
        reportCount: 0,
        status: "active",
      }),
    );
  });

  it("rejects owner creating a well-formed dataset", async () => {
    const ctx = testEnv.authenticatedContext("u1");
    const ref = doc(ctx.firestore(), "datasets/d1");
    await assertFails(
      setDoc(ref, {
        ownerUid: "u1",
        title: "good",
        tags: ["legal"],
        likeCount: 0,
        downloadCount: 0,
        reportCount: 0,
        status: "active",
      }),
    );
  });

  it("rejects dataset creation when client tries to set non-zero counters", async () => {
    const ctx = testEnv.authenticatedContext("u1");
    const ref = doc(ctx.firestore(), "datasets/d1");
    await assertFails(
      setDoc(ref, {
        ownerUid: "u1",
        title: "bad",
        tags: [],
        likeCount: 100, // forbidden — counters are server-side only
        downloadCount: 0,
        reportCount: 0,
        status: "active",
      }),
    );
  });

  it("rejects reading an active dataset from the client", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "datasets/d1"), {
        ownerUid: "u1",
        title: "x",
        tags: [],
        likeCount: 0,
        downloadCount: 0,
        reportCount: 0,
        status: "active",
      });
    });

    const ctx = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(ctx.firestore(), "datasets/d1")));
  });
});
