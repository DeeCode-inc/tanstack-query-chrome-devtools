import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { crx } from "@crxjs/vite-plugin";

import manifest from "./manifest.config";

export default defineConfig({
  build: { rollupOptions: { input: { index: "index.html" } } },
  plugins: [react(), tailwindcss(), crx({ manifest })],
});
