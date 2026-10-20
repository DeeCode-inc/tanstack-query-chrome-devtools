import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "TanStack Query DevTools",
    browser_specific_settings: {
      gecko: {
        id: "tanstack-query-devtools@borysov.dev",
        strict_min_version: "112.0",
      },
    },
    version: "1.1.0",
    description:
      "Real-time TanStack Query devtools in your browser. Inspect queries, mutations, and cache — with zero bundle impact.",
    homepage_url:
      "https://github.com/DeeCode-inc/tanstack-query-chrome-devtools",
    icons: {
      "16": "icon/icon-16.png",
      "48": "icon/icon-48.png",
      "128": "icon/icon-128.png",
    },
    action: {
      default_icon: {
        "16": "icon/icon-16-gray.png",
        "48": "icon/icon-48-gray.png",
        "128": "icon/icon-128-gray.png",
      },
      default_title: "TanStack Query DevTools",
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
