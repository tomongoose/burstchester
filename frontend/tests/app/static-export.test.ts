import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("static export config", () => {
  it("enables static export output", () => {
    expect(nextConfig.output).toBe("export");
  });
});
