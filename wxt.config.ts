import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

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
    version: "1.0.1",
    description: "DevTools extension for debugging TanStack Query applications. Inspect queries, mutations, and cache state in real-time.",
    homepage_url: "https://github.com/DeeCode-inc/tanstack-query-chrome-devtools",
    host_permissions: ["<all_urls>"],
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
