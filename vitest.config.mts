import { defineConfig } from "vitest/config";

// Test files share the application's JSON-backed database. Running them in
// parallel can overwrite another file's fixture store and create false failures.
export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { fileParallelism: false },
});
