const test = require("node:test");
const assert = require("node:assert/strict");

process.env.GCLOUD_PROJECT = "demo-burstchester";
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: "demo-burstchester",
  storageBucket: "demo-burstchester.appspot.com",
});

const {healthCheckHandler} = require("../lib/index.js");

test("healthCheckHandler returns ok payload", async () => {
  const response = {
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

  await healthCheckHandler({}, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    ok: true,
    service: "burstchester-functions",
  });
});
