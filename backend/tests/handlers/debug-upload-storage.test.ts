import { describe, expect, it, vi } from "vitest";

import {
  DEBUG_UPLOAD_STORAGE_PREFIX,
  uploadDebugDatasetRecord,
} from "@/handlers/debug-upload-dataset";

describe("uploadDebugDatasetRecord", () => {
  it("stores debug uploads outside the dataset finalize trigger prefix", async () => {
    const savedPaths: string[] = [];
    const docSet = vi.fn(async () => undefined);

    const deps = {
      storage: {
        bucket: (bucketName?: string) => ({
          name: bucketName ?? "bustchester-e08c3.firebasestorage.app",
          file: (path: string) => ({
            save: async () => {
              savedPaths.push(path);
            },
          }),
        }),
      },
      db: {
        doc: () => ({
          set: docSet,
        }),
      },
      clock: {
        now: () => ({
          toDate: () => new Date("2026-05-08T00:00:00.000Z"),
        }),
      },
      fieldValue: {
        increment: () => ({ __increment: 1 }),
      },
    };

    await uploadDebugDatasetRecord(deps as never, {
      ownerUid: "u-debugger",
      ownerName: "Debugger",
      filename: "debug-dataset.jsonl",
      content:
        '{"messages":[{"role":"user","content":"Q"},{"role":"assistant","content":"A"}]}\n',
      metadata: {
        datasetId: "debug-dataset",
        sourceModel: "human",
      },
    });

    expect(savedPaths[0]).toBe(
      `${DEBUG_UPLOAD_STORAGE_PREFIX}/u-debugger/debug-dataset.jsonl`,
    );
  });
});
