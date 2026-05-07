const MAX_CONTENT_LENGTH = 200;

export interface PreviewMessage {
  readonly role: string;
  readonly content: string;
}

export interface PreviewSample {
  readonly messages: readonly PreviewMessage[];
}

export function parsePreviewLines(jsonl: string, n: number): readonly PreviewSample[] {
  if (!jsonl) return [];
  const samples: PreviewSample[] = [];
  for (const line of jsonl.split("\n")) {
    if (samples.length >= n) break;
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sample = parseSample(trimmed);
    if (sample) samples.push(sample);
  }
  return Object.freeze(samples);
}

function parseSample(line: string): PreviewSample | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(raw) || !Array.isArray(raw.messages)) return null;

  const messages = raw.messages
    .filter(isRecord)
    .map((m) =>
      Object.freeze({
        role: String(m.role ?? ""),
        content: truncate(String(m.content ?? ""), MAX_CONTENT_LENGTH),
      }),
    );
  return Object.freeze({ messages: Object.freeze(messages) });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}
