import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const DEFAULT_SESSION_PATH = join(homedir(), ".burstchester", "session.json");

export function getSessionPath(customPath) {
  return customPath || DEFAULT_SESSION_PATH;
}

export async function loadSession(customPath) {
  try {
    const raw = await readFile(getSessionPath(customPath), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function saveSession(session, customPath) {
  const sessionPath = getSessionPath(customPath);
  await mkdir(dirname(sessionPath), { recursive: true });
  await writeFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  return sessionPath;
}

export async function clearSession(customPath) {
  await rm(getSessionPath(customPath), { force: true });
}
