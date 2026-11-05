import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, ".."),
  server: { host: "127.0.0.1", port: 18182, strictPort: true },
  resolve: {
    alias: { "@": path.resolve(__dirname, "../src") },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
});
