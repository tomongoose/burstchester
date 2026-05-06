import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest, type HttpsFunction } from "firebase-functions/v2/https";

export async function handleHealthCheck(
  _request: Request,
  response: Response,
): Promise<void> {
  logger.info("healthCheck invoked");
  response.status(200).json({
    ok: true,
    service: "burstchester-functions",
  });
}

export function createHealthCheck(): HttpsFunction {
  return onRequest({ region: "us-central1" }, handleHealthCheck);
}
