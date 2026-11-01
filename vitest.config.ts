import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "prisma/migrations"],
    coverage: {
      provider: "v8",
      include: ["lib/costs/**/*.ts"],
      exclude: ["lib/costs/**/*.test.ts"],
      reporter: ["text", "json", "html"],
      thresholds: { branches: 95 },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
