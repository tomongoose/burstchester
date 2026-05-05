const test = require("node:test");
const assert = require("node:assert/strict");

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
