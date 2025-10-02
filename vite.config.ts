import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) =>
  mode === "main"
    ? {
        plugins: [react(), tailwindcss()],
        build: {
          rollupOptions: {
            input: {
              // DevTools panel (React app)
              panel: "index.html",
              // DevTools entry point
              devtools: "devtools.html",
              // Popup (React app)
              popup: "popup.html",
              // Background service worker
              background: "src/background/background.ts",
            },
            output: {
              entryFileNames: (chunkInfo) => {
                switch (chunkInfo.name) {
                  case "background":
                    return "background.js";
                  default:
                    return "assets/[name]-[hash].js";
                }
              },
              chunkFileNames: () => "assets/[name]-[hash].js",
              assetFileNames: "assets/[name]-[hash].[ext]",
            },
          },
        },
      }
    : mode === "content"
      ? {
          build: {
            emptyOutDir: false,
            lib: {
              entry: "src/content/content.ts",
              formats: ["iife"],
              fileName: () => "content.js",
              name: "contentScript",
            },
          },
        }
      : mode === "injected"
        ? {
            build: {
              emptyOutDir: false,
              lib: {
                entry: "src/injected/injected.ts",
                formats: ["iife"],
                fileName: () => "injected.js",
                name: "injectedScript",
              },
            },
          }
        : {},
);
