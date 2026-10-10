import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      // `server-only` throws by design outside RSC; no-op it under tests.
      "server-only": path.resolve(
        import.meta.dirname,
        "./test/server-only-stub.ts",
      ),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
