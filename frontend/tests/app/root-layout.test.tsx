import { describe, expect, it } from "vitest";

import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("suppresses hydration warnings on the html root for extension-injected attributes", () => {
    const tree = RootLayout({
      children: <div>content</div>,
    });

    expect(tree.props.suppressHydrationWarning).toBe(true);
  });
});
