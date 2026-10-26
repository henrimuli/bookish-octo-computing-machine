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
  },
});
