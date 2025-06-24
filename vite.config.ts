import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) =>
  mode === "injected"
    ? {
        build: {
          emptyOutDir: false,
          lib: {
            entry: resolve(__dirname, "src/injected/injected.ts"),
            name: "injected",
            fileName: () => "injected.js",
            formats: ["iife"],
          },
          rollupOptions: {
            output: {
              extend: true,
            },
          },
        },
      }
    : {
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
            },
            output: {
              entryFileNames: (chunkInfo) => {
                if (chunkInfo.name === "content") return "content.js";
                if (chunkInfo.name === "background") return "background.js";
                return "assets/[name]-[hash].js";
              },
              chunkFileNames: "assets/[name]-[hash].js",
              assetFileNames: "assets/[name]-[hash].[ext]",
            },
          },
        },
      },
);
