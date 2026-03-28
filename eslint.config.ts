import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

import eslint from "@eslint/js";

export default defineConfig([
  { ignores: ["**/node_modules/**", "**/dist/**", ".output/**", ".wxt/**", ".github/agents/**", ".github/prompts/**", ".specify/**", "specs/**"] },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [tseslint.configs.recommendedTypeChecked, tseslint.configs.stylisticTypeChecked, pluginReact.configs.flat["jsx-runtime"], eslint.configs.recommended, 'react-hooks/recommended'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
     plugins: {
      'react-hooks': reactHooks,
    },
  },
  // @ts-expect-error - type of css is wrong, but it works
  { files: ["**/*.css"], plugins: { css }, language: "css/css", extends: ["css/recommended"] },
  // @ts-expect-error - type of markdown is wrong, but it works
  { files: ["**/*.md"], plugins: { markdown }, language: "markdown/gfm", extends: ["markdown/recommended"] },
]);
