import { defineConfig } from "vitest/config";

// Test files share the application's JSON-backed database. Running them in
// parallel can overwrite another file's fixture store and create false failures.
export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    fileParallelism: false,
    // Never append test generations to the bundled development seed. A fresh
    // store keeps repeated validation runs isolated and prevents JSON writes
    // from becoming progressively slower.
    env: {
      DATABASE_PATH: `/tmp/sprout-vitest-${process.pid}-${Date.now()}.json`,
    },
    setupFiles: ["./src/tests/setup.ts"],
  },
});
