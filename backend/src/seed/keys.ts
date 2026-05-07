import { createHash } from "node:crypto";
import type { HuggingFaceLocator } from "./hugging-face-locator";

export function computeSeedKey(locator: HuggingFaceLocator): string {
  const digest = createHash("sha256")
    .update(`${locator.huggingFaceId}#${locator.revision}`)
    .digest("hex");
  return `seed-${digest.slice(0, 32)}`;
}
