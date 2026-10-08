import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // bundle.test.ts builds the bundle and starts it as a child process for each client.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
