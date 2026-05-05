import { defineConfig } from "vitest/config";

// Rules tests run against a live emulator and must be invoked through
// `firebase emulators:exec`. Kept separate from the default Vitest config so
// that `npm test` can run unit tests offline.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/rules/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
