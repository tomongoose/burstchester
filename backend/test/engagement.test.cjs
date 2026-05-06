const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyDownloadStats,
  applyLikeWrite,
  applyReportWrite,
} = require("../lib/core/engagement.js");

test("applyLikeWrite increments dataset likes and owner reputation on create", () => {
  const result = applyLikeWrite(
    {
      likeCount: 1,
      reportCount: 0,
      ownerUid: "owner-1",
    },
    false,
    true,
  );

  assert.equal(result.dataset.likeCount, 2);
  assert.equal(result.owner.reputationDelta, 1);
});

test("applyLikeWrite decrements dataset likes and owner reputation on delete", () => {
  const result = applyLikeWrite(
    {
      likeCount: 2,
      reportCount: 0,
      ownerUid: "owner-1",
    },
    true,
    false,
  );

  assert.equal(result.dataset.likeCount, 1);
  assert.equal(result.owner.reputationDelta, -1);
});

test("applyReportWrite flags dataset at threshold", () => {
  const result = applyReportWrite(
    {
      reportCount: 2,
      status: "active",
      ownerUid: "owner-1",
    },
    false,
    true,
  );

  assert.equal(result.dataset.reportCount, 3);
  assert.equal(result.dataset.status, "flagged");
  assert.equal(result.owner.reputationDelta, -5);
});

test("applyDownloadStats increments dataset and owner download counters", () => {
  const result = applyDownloadStats({
    ownerUid: "owner-1",
    downloadCount: 7,
  });

  assert.equal(result.dataset.downloadCount, 8);
  assert.equal(result.owner.downloadCountDelta, 1);
});
