import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@/services", replacement: path.resolve(__dirname, "src/services") },
      { find: "@/lib", replacement: path.resolve(__dirname, "src/lib") },
      { find: "@/adapters", replacement: path.resolve(__dirname, "src/adapters") },
      { find: "@/types", replacement: path.resolve(__dirname, "src/types") },
      { find: "@/utils", replacement: path.resolve(__dirname, "src/utils") },
      { find: "@", replacement: path.resolve(__dirname) },
    ],
  },
  test: { setupFiles: ["tests/setup.ts"], include: ["tests/**/*.test.ts"], environment: "node", testTimeout: 15000 },
});
