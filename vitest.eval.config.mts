import { defineConfig } from "vitest/config";
import { existsSync } from "node:fs";
import path from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  test: {
    include: ["test/eval/**/*.eval.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "server-only": path.resolve(
        import.meta.dirname,
        "./test/server-only-stub.ts",
      ),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
