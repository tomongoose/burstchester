import { initializeApp } from "firebase-admin/app";
import type { Request, Response } from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

initializeApp();

export async function healthCheckHandler(
  _request: Request,
  response: Response,
): Promise<void> {
  logger.info("healthCheck invoked");
  response.status(200).json({
    ok: true,
    service: "burstchester-functions",
  });
}

export const healthCheck = onRequest({ region: "us-central1" }, healthCheckHandler);
