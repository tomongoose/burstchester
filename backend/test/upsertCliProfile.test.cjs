const test = require("node:test");
const assert = require("node:assert/strict");

process.env.GCLOUD_PROJECT = "demo-burstchester";
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: "demo-burstchester",
  storageBucket: "demo-burstchester.appspot.com",
});

const { upsertCliProfileHandler } = require("../lib/index.js");

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test("upsertCliProfileHandler rejects requests without bearer token", async () => {
  const response = createResponse();

  await upsertCliProfileHandler(
    { headers: {}, body: { displayName: "Alice" } },
    response,
    {
      verifyIdToken: async () => {
        throw new Error("should not be called");
      },
      upsertProfile: async () => {
        throw new Error("should not be called");
      },
    },
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, {
    ok: false,
    error: "Missing bearer token.",
  });
});

test("upsertCliProfileHandler upserts profile from verified token", async () => {
  const response = createResponse();

  await upsertCliProfileHandler(
    {
      headers: {
        authorization: "Bearer firebase-id-token",
      },
      body: {
        displayName: "Alice",
        photoURL: "https://example.com/p.png",
      },
    },
    response,
    {
      verifyIdToken: async (idToken) => {
        assert.equal(idToken, "firebase-id-token");
        return {
          uid: "u-alice",
          email: "alice@example.com",
        };
      },
      upsertProfile: async ({ uid, email, displayName, photoURL }) => ({
        uid,
        email,
        displayName,
        photoURL,
      }),
    },
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    ok: true,
    profile: {
      uid: "u-alice",
      email: "alice@example.com",
      displayName: "Alice",
      photoURL: "https://example.com/p.png",
    },
  });
});
