import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use node environment (no DOM needed for middleware).
    environment: "node",
    // Run tests sequentially within files, parallel files.
    pool: "threads",
    // Show verbose test names.
    reporter: "verbose",
    // Include only benchmark tests when running test:benchmark.
    include: ["tests/**/*.test.ts"],
  },
});
