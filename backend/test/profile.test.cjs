const test = require("node:test");
const assert = require("node:assert/strict");
const { Timestamp } = require("firebase-admin/firestore");

const { buildUserProfile } = require("../lib/core/profiles.js");

const TEST_NOW = Timestamp.fromDate(new Date("2026-05-05T00:00:00Z"));

test("buildUserProfile initializes counters and copies auth fields", () => {
  const profile = buildUserProfile(
    {
      uid: "user-1",
      displayName: "Burst Tester",
      email: "tester@example.com",
      photoURL: "https://example.com/avatar.png",
    },
    TEST_NOW,
  );

  assert.equal(profile.uid, "user-1");
  assert.equal(profile.displayName, "Burst Tester");
  assert.equal(profile.email, "tester@example.com");
  assert.equal(profile.photoURL, "https://example.com/avatar.png");
  assert.equal(profile.uploadCount, 0);
  assert.equal(profile.downloadCount, 0);
  assert.equal(profile.reputation, 0);
  assert.equal(typeof profile.createdAt.toMillis, "function");
});
