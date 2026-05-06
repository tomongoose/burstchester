import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

export async function ensureDir(path) {
  await mkdir(path, { recursive: true });
  return path;
}

export async function downloadToFile({
  url,
  destination,
  headers = {},
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(url, { headers });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed for ${url} with status ${response.status}.`);
  }

  await ensureDir(dirname(destination));
  await pipeline(response.body, createWriteStream(destination));
  return destination;
}

export async function writeJson(path, value) {
  const absolutePath = resolve(path);
  await ensureDir(dirname(absolutePath));
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return absolutePath;
}
