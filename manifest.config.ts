import { defineManifest } from "@crxjs/vite-plugin";

import packageJson from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: packageJson.description,
  version: packageJson.version,
  description:
    "Chrome DevTools extension for debugging TanStack Query applications. Inspect queries, mutations, and cache state in real-time.",
  homepage_url: packageJson.homepage,
  author: { email: packageJson.author.email },
  permissions: ["storage"],
  devtools_page: "devtools.html",
  content_scripts: [
    { matches: ["<all_urls>"], js: ["src/content/content.ts"] },
  ],
  background: {
    service_worker: "src/background/background.ts",
  },
  icons: {
    "16": "icon-16.png",
    "48": "icon-48.png",
    "128": "icon-128.png",
  },
});
