import { normalizeDatasetId } from "./session.mjs";

export function parseDatasetIdFile(text) {
  const ids = [];

  for (const [index, line] of String(text).split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (looksLikeTrainingRecord(trimmed)) {
      throw new Error(
        `Dataset id input contains a JSON training record on line ${index + 1}. Pass dataset ids such as "legal-ko", not a merged JSONL training file.`,
      );
    }

    for (const value of trimmed.split(",")) {
      const normalized = normalizeDatasetId(value);
      if (normalized && !ids.includes(normalized)) {
        ids.push(normalized);
      }
    }
  }

  return ids;
}

export function normalizeDatasetIds(values) {
  const ids = [];

  for (const value of Array.isArray(values) ? values : [values]) {
    for (const datasetId of parseDatasetIdFile(value)) {
      if (!ids.includes(datasetId)) {
        ids.push(datasetId);
      }
    }
  }

  return ids;
}

export function serializeDatasetIds(datasetIds) {
  const normalized = [];

  for (const value of datasetIds) {
    const datasetId = normalizeDatasetId(value);
    if (datasetId && !normalized.includes(datasetId)) {
      normalized.push(datasetId);
    }
  }

  return normalized.length > 0 ? `${normalized.join("\n")}\n` : "";
}

function looksLikeTrainingRecord(value) {
  if (!value.startsWith("{") && !value.startsWith("[")) {
    return false;
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return true;
    }
    return Boolean(
      parsed
        && typeof parsed === "object"
        && (
          Array.isArray(parsed.messages)
          || typeof parsed.prompt === "string"
          || typeof parsed.completion === "string"
          || typeof parsed.input === "string"
          || typeof parsed.output === "string"
          || typeof parsed.text === "string"
        ),
    );
  } catch {
    return true;
  }
}
