import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Integration tests share one database.
    fileParallelism: false,
    // Integration setup drops the schema and applies every migration.
    hookTimeout: 30_000,
    // Integration tests run many queries against a real database; 5s is tight on slow machines.
    testTimeout: 20_000,
  },
});
