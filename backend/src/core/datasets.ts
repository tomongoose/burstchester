import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";

import { evaluateSourceModel, type SourceModelEvaluation } from "./source-models";
import { type DatasetStatus } from "./dataset-status";

export { type DatasetStatus };

export type DatasetFormat = "openai-messages" | "sharegpt" | "alpaca";
export type TaskType = "instruction" | "chat" | "completion" | "tool-use";

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

interface NormalizedSample {
  messages: Message[];
}

export interface ValidationResult {
  status: DatasetStatus;
  rejectReason?: string;
  detectedFormat: DatasetFormat;
  normalizedFormat: "openai-messages";
  normalizedJsonl: string;
  normalizedSamples: NormalizedSample[];
  rowCount: number;
  byteSize: number;
  avgUserTokens: number;
  avgAssistantTokens: number;
  piiFindings: string[];
  sampleHashes: string[];
  sampleHashesMerkleRoot: string;
  sourceModelEvaluation: SourceModelEvaluation;
}

export interface UploadMetadataInput {
  readonly datasetId?: string;
  readonly ownerUid?: string;
  readonly ownerName?: string;
  readonly title?: string;
  readonly description?: string;
  readonly tags?: string;
  readonly baseModelHint?: string;
  readonly taskType?: string;
  readonly language?: string;
  readonly license?: string;
  readonly sourceModel?: string;
  readonly sourceConfirmed?: string;
  readonly outputModelId?: string;
  readonly format?: string;
}

export interface StorageObjectInput {
  readonly name?: string | null;
  readonly bucket: string;
  readonly contentType?: string | null;
  readonly size?: number | string | null;
  readonly metadata?: UploadMetadataInput;
}

export interface DatasetRecord {
  readonly id: string;
  readonly ownerUid: string;
  readonly ownerName: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly baseModelHint: string;
  readonly taskType: TaskType;
  readonly format: "openai-messages";
  readonly language: string;
  readonly license: string;
  readonly rowCount: number;
  readonly byteSize: number;
  readonly avgUserTokens: number;
  readonly avgAssistantTokens: number;
  readonly storagePath: string;
  readonly normalizedStoragePath: string | null;
  readonly zipPath: string | null;
  readonly sourceModel: string;
  readonly sourceModelLicense: SourceModelEvaluation["license"];
  readonly sourceConfirmed: boolean;
  readonly outputModelId: string | null;
  readonly parentDatasets: readonly string[];
  readonly samplingMethod: "manual-curate" | "llm-output" | "human-write" | "mixed" | null;
  readonly capabilityTags: readonly string[];
  readonly sampleHashesMerkleRoot: string;
  readonly likeCount: number;
  readonly downloadCount: number;
  readonly reportCount: number;
  readonly searchKeywords: readonly string[];
  readonly status: DatasetStatus;
  readonly rejectReason?: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface DatasetUploadDeps {
  downloadObjectText: (bucket: string, path: string) => Promise<string>;
  saveNormalizedText: (path: string, text: string, bucket: string) => Promise<void>;
  upsertDataset: (record: DatasetRecord) => Promise<void>;
  incrementUserUploads: (ownerUid: string) => Promise<void>;
}

const PII_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { label: "phone", pattern: /(?:\+?\d{1,3}[-.\s]?)?(?:\d{2,4}[-.\s]?){2,3}\d{4}\b/ },
  { label: "ssn", pattern: /\b\d{6}[- ]?\d{7}\b|\b\d{3}-\d{2}-\d{4}\b/ },
  { label: "credit-card", pattern: /\b(?:\d[ -]*?){13,16}\b/ },
  { label: "api-key", pattern: /\b(?:sk|rk|api|token)[-_a-z0-9]{12,}\b/i },
];

const ALLOWED_ROLES = new Set(["system", "user", "assistant", "tool"]);

export function validateDatasetUpload(input: {
  content: string;
  sourceModel: string;
}): ValidationResult {
  const lines = input.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return rejectedValidation("openai-messages", "Upload file is empty.", input.sourceModel);
  }

  const normalizedSamples: NormalizedSample[] = [];
  let detectedFormat: DatasetFormat = "openai-messages";

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return rejectedValidation(detectedFormat, "Invalid JSONL line encountered.", input.sourceModel);
    }

    const normalized = normalizeSample(parsed);
    if ("rejectReason" in normalized) {
      return rejectedValidation(
        normalized.detectedFormat,
        normalized.rejectReason,
        input.sourceModel,
      );
    }

    detectedFormat = normalized.detectedFormat;
    normalizedSamples.push({ messages: normalized.messages });
  }

  const normalizedLines = normalizedSamples.map((sample) => JSON.stringify(sample));
  const normalizedJsonl = `${normalizedLines.join("\n")}\n`;
  const piiFindings = findPiiFindings(normalizedJsonl);
  const sourceModelEvaluation = evaluateSourceModel(input.sourceModel);

  const avgUserTokens = averageRoleTokens(normalizedSamples, "user");
  const avgAssistantTokens = averageRoleTokens(normalizedSamples, "assistant");
  const sampleHashes = normalizedLines.map(sha256);
  const sampleHashesMerkleRoot = buildMerkleRoot(sampleHashes);

  let status: DatasetStatus = "active";
  let rejectReason: string | undefined;

  if (sourceModelEvaluation.disposition === "reject") {
    status = "rejected";
    rejectReason = `Rejected source model: ${sourceModelEvaluation.reason}`;
  } else if (sourceModelEvaluation.disposition === "pending_review") {
    status = "pending_review";
  }

  if (status !== "rejected" && piiFindings.length > 0) {
    status = "pending_review";
  }

  return {
    status,
    rejectReason,
    detectedFormat,
    normalizedFormat: "openai-messages",
    normalizedJsonl,
    normalizedSamples,
    rowCount: normalizedSamples.length,
    byteSize: Buffer.byteLength(input.content, "utf8"),
    avgUserTokens,
    avgAssistantTokens,
    piiFindings,
    sampleHashes,
    sampleHashesMerkleRoot,
    sourceModelEvaluation,
  };
}

export interface UploadPreconditionInput {
  readonly name: string;
  readonly size: number;
  readonly sourceConfirmed: boolean;
}

export function checkUploadPreconditions(input: UploadPreconditionInput): string | null {
  if (!input.name.endsWith(".jsonl")) {
    return "Only .jsonl uploads are allowed.";
  }
  if (input.size > 100 * 1024 * 1024) {
    return "Upload exceeds 100MB limit.";
  }
  if (!input.sourceConfirmed) {
    return "Source confirmation is required.";
  }
  return null;
}

export async function processDatasetUpload(
  object: StorageObjectInput,
  deps: DatasetUploadDeps,
  now: Timestamp,
): Promise<DatasetRecord> {
  const name = object.name?.trim() ?? "";
  const metadata = object.metadata ?? {};
  const size = typeof object.size === "string" ? Number(object.size) : object.size ?? 0;
  const datasetId = metadata.datasetId?.trim() || deriveDatasetId(name);
  const ownerUid = metadata.ownerUid?.trim() ?? deriveOwnerUid(name);
  const sourceConfirmed = metadata.sourceConfirmed?.trim() === "true";

  const baseRecord = createBaseDatasetRecord({
    datasetId,
    ownerUid,
    ownerName: metadata.ownerName?.trim() ?? ownerUid,
    title: metadata.title?.trim() ?? datasetId,
    description: metadata.description?.trim() ?? "",
    tags: parseTags(metadata.tags),
    baseModelHint: metadata.baseModelHint?.trim() ?? "",
    taskType: normalizeTaskType(metadata.taskType),
    language: metadata.language?.trim() ?? "unknown",
    license: metadata.license?.trim() ?? "custom",
    sourceModel: metadata.sourceModel?.trim() ?? "unknown",
    sourceConfirmed,
    outputModelId: metadata.outputModelId?.trim() || null,
    storagePath: `gs://${object.bucket}/${name}`,
    now,
  });

  const preconditionError = checkUploadPreconditions({ name, size, sourceConfirmed });
  if (preconditionError) {
    const rejected: DatasetRecord = Object.freeze({
      ...baseRecord,
      status: "rejected" as const,
      rejectReason: preconditionError,
    });
    await deps.upsertDataset(rejected);
    return rejected;
  }

  const content = await deps.downloadObjectText(object.bucket, name);
  const validation = validateDatasetUpload({
    content,
    sourceModel: baseRecord.sourceModel,
  });

  const normalizedStoragePath =
    validation.status === "rejected" ? null : `normalized/${datasetId}/dataset.jsonl`;

  const record: DatasetRecord = Object.freeze({
    ...baseRecord,
    format: validation.normalizedFormat,
    rowCount: validation.rowCount,
    byteSize: validation.byteSize,
    avgUserTokens: validation.avgUserTokens,
    avgAssistantTokens: validation.avgAssistantTokens,
    normalizedStoragePath,
    sourceModelLicense: validation.sourceModelEvaluation.license,
    sampleHashesMerkleRoot: validation.sampleHashesMerkleRoot,
    searchKeywords: buildSearchKeywords(
      baseRecord.title,
      baseRecord.description,
      baseRecord.tags,
      baseRecord.baseModelHint,
      baseRecord.language,
    ),
    status: validation.status,
    rejectReason: validation.rejectReason,
    samplingMethod: baseRecord.sourceModel === "human" ? "human-write" : "llm-output",
  });

  if (validation.status !== "rejected" && normalizedStoragePath) {
    await deps.saveNormalizedText(normalizedStoragePath, validation.normalizedJsonl, object.bucket);
    await deps.incrementUserUploads(ownerUid);
  }

  await deps.upsertDataset(record);
  return record;
}

function createBaseDatasetRecord(input: {
  datasetId: string;
  ownerUid: string;
  ownerName: string;
  title: string;
  description: string;
  tags: string[];
  baseModelHint: string;
  taskType: TaskType;
  language: string;
  license: string;
  sourceModel: string;
  sourceConfirmed: boolean;
  outputModelId: string | null;
  storagePath: string;
  now: Timestamp;
}): DatasetRecord {
  const { now } = input;
  return {
    id: input.datasetId,
    ownerUid: input.ownerUid,
    ownerName: input.ownerName,
    title: input.title,
    description: input.description,
    tags: input.tags,
    baseModelHint: input.baseModelHint,
    taskType: input.taskType,
    format: "openai-messages",
    language: input.language,
    license: input.license,
    rowCount: 0,
    byteSize: 0,
    avgUserTokens: 0,
    avgAssistantTokens: 0,
    storagePath: input.storagePath,
    normalizedStoragePath: null,
    zipPath: null,
    sourceModel: input.sourceModel,
    sourceModelLicense: "other",
    sourceConfirmed: input.sourceConfirmed,
    outputModelId: input.outputModelId,
    parentDatasets: [],
    samplingMethod: null,
    capabilityTags: [],
    sampleHashesMerkleRoot: "",
    likeCount: 0,
    downloadCount: 0,
    reportCount: 0,
    searchKeywords: [],
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeSample(
  parsed: unknown,
):
  | { detectedFormat: DatasetFormat; messages: Message[] }
  | { detectedFormat: DatasetFormat; rejectReason: string } {
  if (isRecord(parsed) && Array.isArray(parsed.messages)) {
    const messages = normalizeMessages(parsed.messages);
    return messages.rejectReason
      ? { detectedFormat: "openai-messages", rejectReason: messages.rejectReason }
      : { detectedFormat: "openai-messages", messages: messages.messages };
  }

  if (isRecord(parsed) && Array.isArray(parsed.conversations)) {
    const mapped = parsed.conversations.map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const from = String(entry.from ?? "").trim().toLowerCase();
      const role =
        from === "human" ? "user" :
          from === "gpt" ? "assistant" :
            from === "system" ? "system" :
              from === "tool" ? "tool" :
                null;

      return role ? { role, content: String(entry.value ?? "") } : null;
    });

    if (mapped.some((entry) => entry === null)) {
      return { detectedFormat: "sharegpt", rejectReason: "ShareGPT conversation has an unsupported role." };
    }

    const messages = normalizeMessages(mapped as Message[]);
    return messages.rejectReason
      ? { detectedFormat: "sharegpt", rejectReason: messages.rejectReason }
      : { detectedFormat: "sharegpt", messages: messages.messages };
  }

  if (isRecord(parsed) && "instruction" in parsed && "output" in parsed) {
    const instruction = String(parsed.instruction ?? "").trim();
    const input = String(parsed.input ?? "").trim();
    const output = String(parsed.output ?? "").trim();
    const userContent = input ? `${instruction}\n\n${input}` : instruction;

    const messages = normalizeMessages([
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: userContent },
      { role: "assistant", content: output },
    ]);
    return messages.rejectReason
      ? { detectedFormat: "alpaca", rejectReason: messages.rejectReason }
      : { detectedFormat: "alpaca", messages: messages.messages };
  }

  return { detectedFormat: "openai-messages", rejectReason: "Unsupported dataset sample format." };
}

function normalizeMessages(
  messages: Array<{ role: unknown; content: unknown }>,
): { messages: Message[]; rejectReason?: string } {
  const normalized = messages.map((message) => ({
    role: String(message.role ?? "").trim().toLowerCase(),
    content: String(message.content ?? "").trim(),
  }));

  if (normalized.length === 0) {
    return { messages: [], rejectReason: "Sample must contain at least one message." };
  }

  for (const message of normalized) {
    if (!ALLOWED_ROLES.has(message.role)) {
      return { messages: [], rejectReason: `Unsupported role: ${message.role}` };
    }

    if (!message.content) {
      return { messages: [], rejectReason: "Messages must not have empty content." };
    }
  }

  if (normalized[0].role === "assistant") {
    return { messages: [], rejectReason: "First message cannot be assistant." };
  }

  if (normalized.at(-1)?.role !== "assistant") {
    return { messages: [], rejectReason: "Last message must be assistant." };
  }

  const tokenEstimate = normalized.reduce((sum, message) => sum + estimateTokens(message.content), 0);
  if (tokenEstimate > 32_000) {
    return { messages: [], rejectReason: "Sample exceeds 32k token estimate." };
  }

  return {
    messages: normalized as Message[],
  };
}

function rejectedValidation(
  detectedFormat: DatasetFormat,
  rejectReason: string,
  sourceModel: string,
): ValidationResult {
  return {
    status: "rejected",
    rejectReason,
    detectedFormat,
    normalizedFormat: "openai-messages",
    normalizedJsonl: "",
    normalizedSamples: [],
    rowCount: 0,
    byteSize: 0,
    avgUserTokens: 0,
    avgAssistantTokens: 0,
    piiFindings: [],
    sampleHashes: [],
    sampleHashesMerkleRoot: "",
    sourceModelEvaluation: evaluateSourceModel(sourceModel),
  };
}

function averageRoleTokens(samples: NormalizedSample[], role: Message["role"]): number {
  if (samples.length === 0) {
    return 0;
  }

  const total = samples.reduce((sum, sample) => {
    const roleContent = sample.messages
      .filter((message) => message.role === role)
      .map((message) => estimateTokens(message.content))
      .reduce((roleSum, count) => roleSum + count, 0);
    return sum + roleContent;
  }, 0);

  return Math.round((total / samples.length) * 100) / 100;
}

function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

export function findPiiFindings(content: string): string[] {
  return PII_PATTERNS.filter(({ pattern }) => pattern.test(content)).map(({ label }) => label);
}

function buildMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) {
    return "";
  }

  let level = [...leaves];
  while (level.length > 1) {
    const nextLevel: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      nextLevel.push(sha256(`${left}${right}`));
    }
    level = nextLevel;
  }
  return level[0];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseTags(rawTags?: string): string[] {
  if (!rawTags) {
    return [];
  }

  const trimmed = rawTags.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((value) => String(value).trim().toLowerCase()).filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return trimmed
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function buildSearchKeywords(
  title: string,
  description: string,
  tags: readonly string[],
  baseModelHint: string,
  language: string,
): string[] {
  const tokens = tokenize([title, description, baseModelHint, language, ...tags].join(" "));
  const prefixes = tokens.flatMap((token) => buildPrefixes(token));
  return Array.from(new Set([...tokens, ...prefixes])).slice(0, 80);
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s:-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function buildPrefixes(token: string): string[] {
  const prefixes: string[] = [];
  const maxLength = Math.min(token.length, 8);
  for (let index = 2; index <= maxLength; index += 1) {
    prefixes.push(token.slice(0, index));
  }
  return prefixes;
}

function deriveDatasetId(path: string): string {
  const filename = path.split("/").at(-1) ?? "dataset";
  return filename.replace(/\.jsonl$/i, "") || "dataset";
}

function deriveOwnerUid(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return segments[1] ?? "unknown";
}

function normalizeTaskType(rawTaskType?: string): TaskType {
  switch (rawTaskType) {
    case "chat":
    case "completion":
    case "tool-use":
      return rawTaskType;
    default:
      return "instruction";
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
