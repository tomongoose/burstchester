const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluateSourceModel } = require("../lib/core/source-models.js");

test("evaluateSourceModel allows Apache family models", () => {
  const result = evaluateSourceModel("qwen3:14b");

  assert.equal(result.disposition, "allow");
  assert.equal(result.license, "apache-2.0");
});

test("evaluateSourceModel rejects closed provider outputs", () => {
  const result = evaluateSourceModel("gpt-4o");

  assert.equal(result.disposition, "reject");
  assert.match(result.reason, /openai/i);
});

test("evaluateSourceModel keeps unknown models pending review", () => {
  const result = evaluateSourceModel("my-custom-lab-model");

  assert.equal(result.disposition, "pending_review");
  assert.equal(result.license, "other");
});
