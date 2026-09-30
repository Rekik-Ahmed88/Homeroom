import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Single static build for web预览, Tauri desktop (AppImage) and Tauri
// Android (APK). Local-only app: no SSR, no server, no database.
export default defineConfig({
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    outDir: "dist",
  },
  plugins: [tailwindcss(), viteReact()],
});
