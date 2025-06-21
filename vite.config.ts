import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        // DevTools panel (React app)
        panel: "index.html",
        // DevTools entry point
        devtools: "devtools.html",
        // Content script
        content: "src/content/content.ts",
        // Background service worker
        background: "src/background/background.ts",
        // Injected script
        injected: "src/injected/injected.ts",
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "content") return "content.js";
          if (chunkInfo.name === "background") return "background.js";
          if (chunkInfo.name === "injected") return "injected.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
