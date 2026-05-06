import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { handleHealthCheck } from "@/handlers/health-check";

describe("handleHealthCheck", () => {
  it("responds with status 200 and an ok payload describing the service", async () => {
    const jsonSpy = vi.fn();
    const statusSpy = vi.fn(() => ({ json: jsonSpy } as unknown as Response));
    const response = { status: statusSpy } as unknown as Response;

    await handleHealthCheck({} as Request, response);

    expect(statusSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      ok: true,
      service: "burstchester-functions",
    });
  });
});
