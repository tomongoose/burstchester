import { readFile } from "node:fs/promises";

import { normalizeDatasetIds, parseDatasetIdFile } from "./dataset-list.mjs";
import { normalizeDatasetId } from "./session.mjs";

export async function resolveDatasetIdsInput({
  flags,
  session,
  readFileImpl = readFile,
  readStdinImpl = readAllStdin,
}) {
  const datasetIdFlags = [
    ...flagValues(flags["dataset-id"]),
    ...flagValues(flags["dataset-ids"]),
  ];
  const explicit = normalizeDatasetIds(datasetIdFlags);
  if (explicit.length > 0) {
    return explicit;
  }

  if (flags["paste-dataset-list"] === true) {
    return parseDatasetIdFile(await readStdinImpl());
  }

  if (typeof flags["dataset-file"] === "string" && flags["dataset-file"].trim()) {
    const datasetFile = flags["dataset-file"].trim();
    const text =
      datasetFile === "-"
        ? await readStdinImpl()
        : await readFileImpl(datasetFile, "utf8");
    return parseDatasetIdFile(text);
  }

  const stored = Array.isArray(session?.datasetIds)
    ? session.datasetIds
      .map((value) => normalizeDatasetId(value))
      .filter(Boolean)
    : [];
  if (stored.length > 0) {
    return stored;
  }

  throw new Error(
    "No dataset ids available. Pass --dataset-id, --dataset-file, or --paste-dataset-list.",
  );
}

function flagValues(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return typeof value === "string" ? [value] : [];
}

async function readAllStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(
    chunks.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
  ).toString("utf8");
}
