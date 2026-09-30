import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 30000,
    env: {
      VITE_SUPABASE_URL: "https://zptkqeiyvkqogrimbvna.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwdGtxZWl5dmtxb2dyaW1idm5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDA2NDksImV4cCI6MjA5MDMxNjY0OX0.RAk79sh0BVaHlShNkiNBh1R1Ij_EIMMrTEBBWG_dH_w",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
