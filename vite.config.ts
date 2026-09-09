import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    cors: true,
  },
  preview: { host: "0.0.0.0", port: 4173, allowedHosts: true },
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
});
