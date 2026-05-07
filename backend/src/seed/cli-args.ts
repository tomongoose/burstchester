export interface SeedCliArgs {
  readonly manifestPath: string;
  readonly dryRun: boolean;
}

export function parseCliArgs(argv: readonly string[]): SeedCliArgs {
  let manifestPath: string | null = null;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--manifest") {
      manifestPath = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  if (!manifestPath) {
    throw new Error("--manifest <path> is required");
  }
  return Object.freeze({ manifestPath, dryRun });
}
