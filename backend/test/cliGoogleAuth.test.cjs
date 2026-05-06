const test = require("node:test");
const assert = require("node:assert/strict");

process.env.GCLOUD_PROJECT = "demo-burstchester";
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: "demo-burstchester",
  storageBucket: "demo-burstchester.appspot.com",
});

const { cliGoogleAuthHandler } = require("../lib/index.js");

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

test("cliGoogleAuthHandler starts device flow for authenticated caller", async () => {
  const response = createResponse();

  await cliGoogleAuthHandler(
    {
      headers: { authorization: "Bearer firebase-id-token" },
      body: { action: "start" },
    },
    response,
    {
      verifyIdToken: async (idToken) => {
        assert.equal(idToken, "firebase-id-token");
        return { uid: "anon-1" };
      },
      startDeviceFlow: async () => ({
        device_code: "device-code",
        user_code: "ABCD-EFGH",
        verification_url: "https://google.com/device",
        interval: 5,
      }),
      pollDeviceFlow: async () => {
        throw new Error("should not poll");
      },
    },
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    ok: true,
    status: "pending",
    deviceCode: "device-code",
    userCode: "ABCD-EFGH",
    verificationUrl: "https://google.com/device",
    interval: 5,
  });
});

test("cliGoogleAuthHandler returns approved when backend exchanged device code", async () => {
  const response = createResponse();

  await cliGoogleAuthHandler(
    {
      headers: { authorization: "Bearer firebase-id-token" },
      body: { action: "poll", deviceCode: "device-code" },
    },
    response,
    {
      verifyIdToken: async () => ({ uid: "anon-1" }),
      startDeviceFlow: async () => {
        throw new Error("should not start");
      },
      pollDeviceFlow: async (deviceCode) => {
        assert.equal(deviceCode, "device-code");
        return {
          status: "approved",
          idToken: "google-id-token",
        };
      },
    },
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    ok: true,
    status: "approved",
    idToken: "google-id-token",
  });
});
