import { describe, it, expect } from "vitest";

import {
  applyDownloadStats,
  applyLikeWrite,
  applyReportWrite,
} from "@/core/engagement";

describe("applyLikeWrite", () => {
  it("increments dataset likes and owner reputation on create", () => {
    const result = applyLikeWrite(
      {
        likeCount: 1,
        reportCount: 0,
        ownerUid: "owner-1",
      },
      false,
      true,
    );

    expect(result.dataset.likeCount).toBe(2);
    expect(result.owner.reputationDelta).toBe(1);
  });

  it("decrements dataset likes and owner reputation on delete", () => {
    const result = applyLikeWrite(
      {
        likeCount: 2,
        reportCount: 0,
        ownerUid: "owner-1",
      },
      true,
      false,
    );

    expect(result.dataset.likeCount).toBe(1);
    expect(result.owner.reputationDelta).toBe(-1);
  });
});

describe("applyReportWrite", () => {
  it("flags dataset at threshold", () => {
    const result = applyReportWrite(
      {
        reportCount: 2,
        status: "active",
        ownerUid: "owner-1",
      },
      false,
      true,
    );

    expect(result.dataset.reportCount).toBe(3);
    expect(result.dataset.status).toBe("flagged");
    expect(result.owner.reputationDelta).toBe(-5);
  });
});

describe("applyDownloadStats", () => {
  it("increments dataset and owner download counters", () => {
    const result = applyDownloadStats({
      ownerUid: "owner-1",
      downloadCount: 7,
    });

    expect(result.dataset.downloadCount).toBe(8);
    expect(result.owner.downloadCountDelta).toBe(1);
  });
});
