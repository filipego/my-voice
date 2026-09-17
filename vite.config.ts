import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
  },
  server: { port: 1420, strictPort: true },
  build: { outDir: "dist" }
});
