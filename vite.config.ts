import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  base: process.env.STATIC_HOSTING_BASE_PATH ?? "/",
  build: { sourcemap: true },
  test: {
    environment: "jsdom",
    // Component-backed Convex tests normally finish in seconds, but Windows CI
    // can spend >15s transforming edge-runtime modules under parallel load.
    // A timeout must not let an unfinished webhook test contaminate the next one.
    testTimeout: 30_000,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    coverage: { reporter: ["text", "json-summary"] },
  },
});
