import { describe, expect, it } from "vitest";
import { transitionStatus, type DatasetStatus } from "@/core/dataset-status";
import { applyReportWrite } from "@/core/engagement";

describe("transitionStatus — single guard for DatasetStatus", () => {
  it("allows pending_review -> active", () => {
    expect(transitionStatus("pending_review", "active")).toBe("active");
  });

  it("allows active -> flagged", () => {
    expect(transitionStatus("active", "flagged")).toBe("flagged");
  });

  it("rejects rejected -> active (one-way)", () => {
    expect(() => transitionStatus("rejected", "active")).toThrow(/transition/i);
  });

  it("rejects removed -> flagged (terminal)", () => {
    expect(() => transitionStatus("removed", "flagged")).toThrow(/transition/i);
  });

  it("is idempotent when target equals current", () => {
    expect(transitionStatus("flagged", "flagged")).toBe("flagged");
    expect(transitionStatus("active", "active")).toBe("active");
  });

  it("throws on unknown status input", () => {
    expect(() => transitionStatus("zombie" as DatasetStatus, "active")).toThrow(/unknown/i);
  });
});

describe("applyReportWrite — uses status guard to protect terminal states", () => {
  it("does not overwrite rejected status when report threshold reached", () => {
    const result = applyReportWrite(
      { ownerUid: "u1", reportCount: 2, status: "rejected" },
      false,
      true,
    );

    expect(result.dataset.status).toBe("rejected");
  });

  it("does not overwrite removed status when report threshold reached", () => {
    const result = applyReportWrite(
      { ownerUid: "u1", reportCount: 2, status: "removed" },
      false,
      true,
    );

    expect(result.dataset.status).toBe("removed");
  });
});
