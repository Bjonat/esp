import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "paquets/**/tests/**/*.test.ts",
      "adaptateurs/**/tests/**/*.test.ts",
      "applications/**/tests/**/*.test.ts",
    ],
    environment: "node",
  },
});
