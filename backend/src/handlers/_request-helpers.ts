import type { Request } from "express";

export function readBearerToken(request: Pick<Request, "headers">): string {
  const header = request.headers?.authorization ?? request.headers?.Authorization;
  if (typeof header !== "string") return "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export function readStringField(body: unknown, field: string): string {
  if (!body || typeof body !== "object" || !(field in body)) return "";
  return String((body as Record<string, unknown>)[field] ?? "");
}

export function readOptionalStringField(body: unknown, field: string): string | null {
  const value = readStringField(body, field).trim();
  return value ? value : null;
}

export function readRecordField(
  body: unknown,
  field: string,
): Record<string, unknown> {
  if (!body || typeof body !== "object" || !(field in body)) return {};
  const value = (body as Record<string, unknown>)[field];
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function readDatasetId(
  request: Pick<Request, "query" | "body">,
): string {
  const queryDatasetId =
    typeof request.query?.datasetId === "string"
      ? request.query.datasetId
      : Array.isArray(request.query?.datasetId)
        ? request.query.datasetId[0]
        : "";
  const bodyDatasetId =
    request.body && typeof request.body === "object" && "datasetId" in request.body
      ? String((request.body as Record<string, unknown>).datasetId ?? "")
      : "";
  return String(bodyDatasetId || queryDatasetId).trim();
}

export function pathFromGsUrl(gsUrl: string): string {
  const match = gsUrl.match(/^gs:\/\/[^/]+\/(.+)$/);
  if (!match) {
    throw new Error(`Unsupported storage path: ${gsUrl}`);
  }
  return match[1];
}

export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)) as T;
  }
  if (value && typeof value === "object") {
    const cleaned = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, stripUndefinedDeep(entry)]);
    return Object.fromEntries(cleaned) as T;
  }
  return value;
}

export function requireEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  throw new Error(
    `Missing required environment variable: ${names.join(" or ")}`,
  );
}
