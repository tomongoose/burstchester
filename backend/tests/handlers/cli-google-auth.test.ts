import { describe, it, expect } from "vitest";

import { createCliGoogleAuthHandler } from "@/handlers/cli-google-auth";

interface ResponseStub {
  statusCode: number;
  body: unknown;
  status(code: number): ResponseStub;
  json(payload: unknown): ResponseStub;
}

function createResponse(): ResponseStub {
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

describe("cliGoogleAuthHandler", () => {
  it("starts device flow for authenticated caller", async () => {
    const response = createResponse();
    const verifiedTokens: string[] = [];

    const handler = createCliGoogleAuthHandler({
      verifyIdToken: async (idToken) => {
        verifiedTokens.push(idToken);
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
    });

    await handler(
      {
        headers: { authorization: "Bearer firebase-id-token" },
        body: { action: "start" },
      },
      response as never,
    );

    expect(verifiedTokens).toEqual(["firebase-id-token"]);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      status: "pending",
      deviceCode: "device-code",
      userCode: "ABCD-EFGH",
      verificationUrl: "https://google.com/device",
      interval: 5,
    });
  });

  it("returns approved when backend exchanged device code", async () => {
    const response = createResponse();
    const polledCodes: string[] = [];

    const handler = createCliGoogleAuthHandler({
      verifyIdToken: async () => ({ uid: "anon-1" }),
      startDeviceFlow: async () => {
        throw new Error("should not start");
      },
      pollDeviceFlow: async (deviceCode) => {
        polledCodes.push(deviceCode);
        return { status: "approved", idToken: "google-id-token" };
      },
    });

    await handler(
      {
        headers: { authorization: "Bearer firebase-id-token" },
        body: { action: "poll", deviceCode: "device-code" },
      },
      response as never,
    );

    expect(polledCodes).toEqual(["device-code"]);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      status: "approved",
      idToken: "google-id-token",
    });
  });
});
