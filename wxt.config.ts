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
        // First version that honors `world: "MAIN"` on manifest content
        // scripts; older ones run sync.content.ts isolated, where it cannot
        // see the page's __TANSTACK_QUERY_CLIENT__
        strict_min_version: "128.0",
      },
    },
    version: "1.1.1",
    description:
      "Real-time TanStack Query devtools in your browser. Inspect queries, mutations, and cache — with zero bundle impact.",
    homepage_url:
      "https://github.com/DeeCode-inc/tanstack-query-chrome-devtools",
    icons: {
      "16": "icon/icon-16.png",
      "48": "icon/icon-48.png",
      "128": "icon/icon-128.png",
    },
    // The toolbar button's default icon and title are set on the popup
    // entrypoint (entrypoints/popup/index.html), which WXT applies to both
    // `action` (MV3) and `browser_action` (MV2).
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
