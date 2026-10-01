import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.ts"],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@supabase/supabase-js": path.resolve(__dirname, "../node_modules/@supabase/supabase-js"),
    },
  },
});