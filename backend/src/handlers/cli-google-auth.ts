import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import type { HandlerDeps } from "./deps";
import { readBearerToken, readStringField, requireEnv } from "./_request-helpers";

export interface GoogleDeviceCodePayload {
  device_code: string;
  user_code: string;
  verification_url?: string;
  verification_uri?: string;
  interval?: number;
}

export type DeviceFlowPollResult =
  | { status: "pending"; interval?: number }
  | { status: "approved"; idToken: string };

export interface CliGoogleAuthHandlerDeps {
  readonly verifyIdToken: HandlerDeps["auth"]["verifyIdToken"];
  readonly startDeviceFlow: () => Promise<GoogleDeviceCodePayload>;
  readonly pollDeviceFlow: (deviceCode: string) => Promise<DeviceFlowPollResult>;
}

export function createCliGoogleAuthHandler(deps: CliGoogleAuthHandlerDeps) {
  return async function handleCliGoogleAuth(
    request: Pick<Request, "headers" | "body">,
    response: Response,
  ): Promise<void> {
    const bearerToken = readBearerToken(request);
    if (!bearerToken) {
      response.status(401).json({ ok: false, error: "Missing bearer token." });
      return;
    }

    const action = readStringField(request.body, "action").trim();
    if (action !== "start" && action !== "poll") {
      response.status(400).json({
        ok: false,
        error: "action must be either 'start' or 'poll'.",
      });
      return;
    }

    try {
      await deps.verifyIdToken(bearerToken);

      if (action === "start") {
        const device = await deps.startDeviceFlow();
        response.status(200).json({
          ok: true,
          status: "pending",
          deviceCode: device.device_code,
          userCode: device.user_code,
          verificationUrl: device.verification_url ?? device.verification_uri,
          interval: device.interval ?? 5,
        });
        return;
      }

      const deviceCode = readStringField(request.body, "deviceCode").trim();
      if (!deviceCode) {
        response.status(400).json({
          ok: false,
          error: "deviceCode is required for poll action.",
        });
        return;
      }

      const result = await deps.pollDeviceFlow(deviceCode);
      if (result.status === "pending") {
        response.status(200).json({
          ok: true,
          status: "pending",
          interval: result.interval ?? 5,
        });
        return;
      }

      response.status(200).json({
        ok: true,
        status: "approved",
        idToken: result.idToken,
      });
    } catch (error) {
      logger.error("cliGoogleAuth failed", error);
      response.status(500).json({
        ok: false,
        error:
          error instanceof Error ? error.message : "CLI Google auth failed.",
      });
    }
  };
}

export function createCliGoogleAuth(deps: Pick<HandlerDeps, "auth">) {
  const handler = createCliGoogleAuthHandler({
    verifyIdToken: deps.auth.verifyIdToken,
    startDeviceFlow: startCliGoogleDeviceFlow,
    pollDeviceFlow: pollCliGoogleDeviceFlow,
  });
  return onRequest({ region: "us-central1" }, handler);
}

interface GoogleTokenPayload {
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleDeviceCodeResponse extends GoogleDeviceCodePayload {
  error?: string;
  error_description?: string;
}

export async function startCliGoogleDeviceFlow(): Promise<GoogleDeviceCodePayload> {
  const clientId = requireEnv("BURSTCHESTER_GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_ID");
  const response = await fetch("https://oauth2.googleapis.com/device/code", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      scope: "openid email profile",
    }),
  });

  const payload = (await response.json()) as GoogleDeviceCodeResponse;
  if (!response.ok) {
    throw new Error(
      payload?.error_description ||
        payload?.error ||
        "Failed to start Google device flow.",
    );
  }
  return payload;
}

export async function pollCliGoogleDeviceFlow(
  deviceCode: string,
): Promise<DeviceFlowPollResult> {
  const clientId = requireEnv(
    "BURSTCHESTER_GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_ID",
  );
  const clientSecret = requireEnv(
    "BURSTCHESTER_GOOGLE_CLIENT_SECRET",
    "GOOGLE_CLIENT_SECRET",
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: deviceCode,
      grant_type: "http://oauth.net/grant_type/device/1.0",
    }),
  });

  const payload = (await response.json()) as GoogleTokenPayload;
  if (response.ok) {
    return {
      status: "approved" as const,
      idToken: String(payload.id_token ?? ""),
    };
  }
  if (payload?.error === "authorization_pending") {
    return { status: "pending" as const, interval: 5 };
  }
  if (payload?.error === "slow_down") {
    return { status: "pending" as const, interval: 10 };
  }
  throw new Error(
    payload?.error_description ||
      payload?.error ||
      "Google device flow polling failed.",
  );
}
