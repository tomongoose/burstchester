import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-geist-sans" }),
  Geist_Mono: () => ({ variable: "font-geist-mono" }),
  Space_Grotesk: () => ({ variable: "font-space-grotesk" }),
}));

import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("suppresses hydration warnings on the html root for extension-injected attributes", () => {
    const tree = RootLayout({
      children: <div>content</div>,
    });

    expect(tree.props.suppressHydrationWarning).toBe(true);
  });
});
