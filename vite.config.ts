import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

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
        injected: "src/injected/injected.ts",
      },
      output: {
        entryFileNames: (chunkInfo) => {
          switch (chunkInfo.name) {
            case "content":
              return "content.js";
            case "background":
              return "background.js";
            case "injected":
              return "injected.js";
            default:
              return "assets/[name]-[hash].js";
          }
        },
        chunkFileNames: ({ name }) =>
          name === "serialization"
            ? "assets/serialization.js"
            : "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
