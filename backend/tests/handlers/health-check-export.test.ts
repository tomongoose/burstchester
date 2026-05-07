import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("firebase-admin/database", () => ({
  getDatabase: () => ({ __brand: "database" }),
}));

vi.hoisted(() => {
  process.env.GCLOUD_PROJECT = "demo-burstchester";
  process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: "demo-burstchester",
    storageBucket: "demo-burstchester.appspot.com",
  });
});

import { healthCheckHandler } from "@/index";

interface ResponseStub {
  statusCode: number;
  body: unknown;
  status(code: number): ResponseStub;
  json(payload: unknown): ResponseStub;
}

describe("healthCheckHandler (re-exported from src/index)", () => {
  it("returns ok payload", async () => {
    const response: ResponseStub = {
      statusCode: 0,
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

    await healthCheckHandler(
      {} as Request,
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      service: "burstchester-functions",
    });
  });
});
