import { describe, expect, it } from "vitest";
import { parseCliArgs } from "@/seed/cli-args";

describe("parseCliArgs", () => {
  it("extracts the manifest path from --manifest flag", () => {
    const args = parseCliArgs(["--manifest", "examples/seeds.json"]);

    expect(args.manifestPath).toBe("examples/seeds.json");
  });

  it("defaults dryRun to false", () => {
    const args = parseCliArgs(["--manifest", "x.json"]);

    expect(args.dryRun).toBe(false);
  });

  it("sets dryRun to true when --dry-run is passed", () => {
    const args = parseCliArgs(["--manifest", "x.json", "--dry-run"]);

    expect(args.dryRun).toBe(true);
  });

  it("throws when --manifest is missing", () => {
    expect(() => parseCliArgs([])).toThrow(/manifest/i);
    expect(() => parseCliArgs(["--dry-run"])).toThrow(/manifest/i);
  });
});
