import { Buffer } from "node:buffer";

import { type DatasetRecord } from "./datasets";
import { type DatasetStatus } from "./dataset-status";

interface ArchiveFile {
  name: string;
  data: Buffer;
}

interface ArchiveInput {
  dataset: DatasetRecord | DownloadableDataset;
  normalizedJsonl: string;
}

export interface DownloadableDataset {
  readonly id: string;
  readonly ownerUid: string;
  readonly ownerName: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly baseModelHint: string;
  readonly taskType: string;
  readonly format: string;
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
  readonly sourceModelLicense: string;
  readonly sourceConfirmed: boolean;
  readonly parentDatasets: readonly string[];
  readonly samplingMethod: string | null;
  readonly capabilityTags: readonly string[];
  readonly sampleHashesMerkleRoot: string;
  readonly likeCount: number;
  readonly downloadCount: number;
  readonly reportCount: number;
  readonly searchKeywords: readonly string[];
  readonly status: DatasetStatus;
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
}

export interface PrepareDownloadDeps {
  getDataset: (datasetId: string) => Promise<DownloadableDataset | null>;
  downloadNormalizedJsonl: (dataset: DownloadableDataset) => Promise<string>;
  saveArchive: (path: string, bytes: Buffer) => Promise<void>;
  getSignedUrl: (path: string, filename: string) => Promise<string>;
  setZipPath: (datasetId: string, zipPath: string) => Promise<void>;
  incrementDownloadStats: (dataset: DownloadableDataset, requesterUid?: string) => Promise<void>;
}

export interface DownloadView {
  readonly cached: boolean;
  readonly zipPath: string;
}

export function getDownloadView(dataset: DownloadableDataset): DownloadView {
  if (dataset.status !== "active" && dataset.status !== "flagged") {
    throw new Error(`Dataset ${dataset.id} is not downloadable.`);
  }
  if (dataset.zipPath) {
    return Object.freeze({ cached: true, zipPath: dataset.zipPath });
  }
  return Object.freeze({ cached: false, zipPath: `downloads/${dataset.id}/${dataset.id}.zip` });
}

export async function prepareDownloadCore(
  input: { datasetId: string; requesterUid?: string },
  deps: PrepareDownloadDeps,
  now: Date,
) {
  const dataset = await deps.getDataset(input.datasetId);
  if (!dataset) {
    throw new Error(`Dataset not found: ${input.datasetId}`);
  }

  const view = getDownloadView(dataset);
  const filename = view.zipPath.split("/").at(-1) || `${dataset.id}.zip`;

  if (view.cached) {
    const url = await deps.getSignedUrl(view.zipPath, filename);
    await deps.incrementDownloadStats(dataset, input.requesterUid);
    return {
      cached: true,
      zipPath: view.zipPath,
      url,
    };
  }

  const normalizedJsonl = await deps.downloadNormalizedJsonl(dataset);
  const archive = createDatasetArchive({ dataset, normalizedJsonl }, now);

  await deps.saveArchive(view.zipPath, archive);
  await deps.setZipPath(dataset.id, view.zipPath);
  await deps.incrementDownloadStats(dataset, input.requesterUid);

  return {
    cached: false,
    zipPath: view.zipPath,
    url: await deps.getSignedUrl(view.zipPath, filename),
  };
}

export function createDatasetArchive(input: ArchiveInput, now: Date): Buffer {
  const meta = {
    id: input.dataset.id,
    title: input.dataset.title,
    description: input.dataset.description,
    owner: {
      uid: input.dataset.ownerUid,
      name: input.dataset.ownerName,
    },
    tags: input.dataset.tags,
    baseModelHint: input.dataset.baseModelHint,
    taskType: input.dataset.taskType,
    format: input.dataset.format,
    language: input.dataset.language,
    license: input.dataset.license,
    stats: {
      rows: input.dataset.rowCount,
      avgUserTokens: input.dataset.avgUserTokens,
      avgAssistantTokens: input.dataset.avgAssistantTokens,
      byteSize: input.dataset.byteSize,
    },
    createdAt: toIsoString(input.dataset.createdAt, now),
    burstchester: {
      version: "1.0",
      url: `https://burstchester.app/d/${input.dataset.id}`,
    },
  };

  const files: ArchiveFile[] = [
    file("dataset.jsonl", input.normalizedJsonl),
    file("dataset.sharegpt.jsonl", convertToShareGptJsonl(input.normalizedJsonl)),
    file("meta.json", JSON.stringify(meta, null, 2)),
    file("Modelfile.template", buildModelfileTemplate(input.dataset)),
    file("README.md", buildReadmeTemplate(input.dataset)),
    file("LICENSE", buildLicenseText(input.dataset)),
  ];

  return createZipArchive(files, now);
}

export function buildModelfileTemplate(dataset: Pick<DownloadableDataset, "title" | "baseModelHint">): string {
  const stopToken = inferStopToken(dataset.baseModelHint);
  return [
    "# Ollama Modelfile — generated by Burstchester",
    "# Replace {{GGUF_PATH}} with the path to your quantized merged model.",
    "FROM {{GGUF_PATH}}",
    "",
    "PARAMETER temperature 0.7",
    "PARAMETER top_p 0.9",
    `PARAMETER stop "${stopToken}"`,
    "",
    "TEMPLATE \"\"\"{{ if .System }}<|im_start|>system",
    "{{ .System }}<|im_end|>",
    "{{ end }}{{ if .Prompt }}<|im_start|>user",
    "{{ .Prompt }}<|im_end|>",
    "{{ end }}<|im_start|>assistant",
    "{{ .Response }}<|im_end|>",
    "\"\"\"",
    "",
    `SYSTEM """You are a model fine-tuned on the "${dataset.title}" dataset from Burstchester."""`,
    "",
  ].join("\n");
}

export interface ReadmeOptions {
  readonly colabUrl?: string;
}

export function buildReadmeTemplate(
  dataset: Pick<
    DownloadableDataset,
    "title" | "description" | "baseModelHint" | "license" | "rowCount" | "language"
  >,
  options: ReadmeOptions = {},
): string {
  const lines: string[] = [
    `# ${dataset.title}`,
    "",
    dataset.description,
    "",
    "## Quick Start",
    "1. Download this archive.",
    "2. Fine-tune your base model with the bundled `dataset.jsonl`.",
    "3. Merge or quantize the result to GGUF.",
    "4. Update `Modelfile.template` and run `ollama create`.",
    "",
    "## Dataset Metadata",
    `- Base model hint: ${dataset.baseModelHint}`,
    `- Language: ${dataset.language}`,
    `- License: ${dataset.license}`,
    `- Rows: ${dataset.rowCount}`,
    "",
    "## Ollama Flow",
    "- Train locally with your preferred LoRA recipe.",
    "- Quantize to GGUF.",
    "- Use the provided Modelfile template with Ollama.",
    "",
  ];

  if (options.colabUrl) {
    lines.push("## Colab Notebook", `- Open in Colab: ${options.colabUrl}`, "");
  }

  return lines.join("\n");
}

function buildLicenseText(dataset: Pick<DownloadableDataset, "title" | "license" | "sourceModel">): string {
  return [
    dataset.title,
    "",
    `Dataset license: ${dataset.license}`,
    `Declared source model: ${dataset.sourceModel}`,
    "",
    "Burstchester distribution notice:",
    "Use this dataset in compliance with its original license and the source-model policy.",
    "",
  ].join("\n");
}

function convertToShareGptJsonl(normalizedJsonl: string): string {
  const lines = normalizedJsonl
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((sample) => ({
      conversations: sample.messages.map((message: { role: string; content: string }) => ({
        from:
          message.role === "user" ? "human" :
            message.role === "assistant" ? "gpt" :
              message.role,
        value: message.content,
      })),
    }));

  return `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`;
}

function inferStopToken(baseModelHint: string): string {
  const normalized = baseModelHint.toLowerCase();
  if (normalized.includes("llama")) {
    return "<|eot_id|>";
  }

  if (normalized.includes("mistral")) {
    return "[/INST]";
  }

  return "<|im_end|>";
}

function file(name: string, content: string): ArchiveFile {
  return {
    name,
    data: Buffer.from(content, "utf8"),
  };
}

function toIsoString(value: unknown, fallback: Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as any).toDate === "function") {
    return (value as any).toDate().toISOString();
  }

  return fallback.toISOString();
}

function createZipArchive(files: ArchiveFile[], now: Date): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of files) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const timestamp = dosTimestamp(now);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(timestamp.time, 10);
    localHeader.writeUInt16LE(timestamp.date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localRecord = Buffer.concat([localHeader, nameBuffer, entry.data]);
    localParts.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(timestamp.time, 12);
    centralHeader.writeUInt16LE(timestamp.date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    const centralRecord = Buffer.concat([centralHeader, nameBuffer]);
    centralParts.push(centralRecord);
    offset += localRecord.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function dosTimestamp(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    time:
      (date.getUTCHours() << 11) |
      (date.getUTCMinutes() << 5) |
      Math.floor(date.getUTCSeconds() / 2),
    date:
      ((year - 1980) << 9) |
      ((date.getUTCMonth() + 1) << 5) |
      date.getUTCDate(),
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[index] = crc >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
