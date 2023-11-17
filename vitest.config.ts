import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    typecheck: {
      include: [
        "src/**/*.ts",
        "src/**/*.test.ts",
        "src/**/*.test-d.ts",
      ]
    }
  },
});
