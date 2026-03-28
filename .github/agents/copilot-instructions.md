# tanstack-query-chrome-devtools-3 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-28

## Active Technologies
- TypeScript 5.9 (strict mode) + React 19, WXT 0.20, Tailwind CSS v4, lucide-react (for mutation status icons) (002-page-layout-placeholders)
- N/A (mock data hardcoded in components) (002-page-layout-placeholders)
- TypeScript 5.9 (strict mode) + React 19, WXT 0.20, `@tanstack/query-core` 5.90, Tailwind CSS v4, lucide-react, highlight.js (003-live-query-sync)
- `browser.storage.session` for service worker state persistence (per Constitution VII) (003-live-query-sync)
- TypeScript 5.9 (strict mode) + WXT 0.20, React 19, `@tanstack/query-core`, `webextension-polyfill` (via WXT) (004-detection-icon-toggle)
- `browser.storage.session` for `connectedTabs` persistence (004-detection-icon-toggle)
- TypeScript 5.9 (strict mode) + React 19, WXT 0.20, `@tanstack/query-core` 5.90 (type definitions only), Tailwind CSS v4, lucide-react, `@tanstack/react-virtual` 3.13 (005-query-detail-panel)
- N/A for this feature (no new storage needs) (005-query-detail-panel)
- TypeScript (strict mode), React 19 + WXT, React 19, Tailwind CSS v4, `@tanstack/query-core`, `lucide-react`, `@tanstack/react-virtual`, `highlight.js` (006-ui-ux-polish)
- N/A (UI-only changes) (006-ui-ux-polish)
- TypeScript (strict mode) + React 19, WXT, @tanstack/query-core, Tailwind CSS v4, lucide-reac (007-action-invalidate-button)
- browser.storage.session (service worker state persistence) (007-action-invalidate-button)
- TypeScript (strict mode) + React 19, WXT, @tanstack/query-core v5.90.20, Tailwind CSS v4, lucide-reac (008-action-refresh-reset-remove)
- TypeScript 5.9 (strict mode) + React 19, WXT 0.20, Tailwind CSS v4, @tanstack/react-virtual, lucide-reac (010-query-status-badges)
- N/A (UI-only feature, no persistence) (010-query-status-badges)
- TypeScript 5.9, React 19, strict mode + WXT 0.20, @tanstack/query-core 5.90, @tanstack/react-virtual 3.13, highlight.js 11.11, lucide-react 0.577 (011-bigint-serialization)
- N/A (extension messaging pipeline only) (011-bigint-serialization)
- TypeScript (strict mode) with React 19 + React 19, WXT, Tailwind CSS v4, lucide-react, @tanstack/query-core (012-query-data-tree-view)
- N/A (UI component—reads query data from props) (012-query-data-tree-view)
- TypeScript (strict mode) with React 19, WXT framework + React 19, WXT, @tanstack/query-core, @tanstack/react-virtual, lucide-react, highlight.js (013-editable-data-tree)
- N/A (browser extension messaging + TanStack Query cache on inspected page) (013-editable-data-tree)
- TypeScript (strict mode) + React 19, WXT, Tailwind CSS v4 (`@tailwindcss/vite`), `@tanstack/react-virtual` (014-status-tags-container-query)
- TypeScript 5.9 (strict mode) + React 19, WXT, Tailwind CSS v4, `@tanstack/query-core`, `@tanstack/react-virtual`, `lucide-react` (015-cache-delete-mutation-tags)
- N/A (ephemeral in-memory state; `browser.storage.session` for service worker recovery) (015-cache-delete-mutation-tags)
- TypeScript 5.x (strict mode) + React 19, WXT, lucide-react, Tailwind CSS v4 (016-copy-clean-treeview)
- TypeScript (strict mode) via WXT framework + React 19, WXT, @tanstack/query-core, lucide-react, highlight.js, Tailwind CSS v4 (017-iterable-map-set-support)
- N/A (extension message passing via `window.postMessage` and `browser.runtime.connect`) (017-iterable-map-set-support)
- TypeScript (strict mode) via WXT framework + React 19, WXT, @tanstack/query-core (types), @tanstack/react-virtual, lucide-react, highlight.js, Tailwind CSS v4 (018-mutation-ux-details)
- browser.storage.session / browser.storage.local (for service worker state) (018-mutation-ux-details)
- TypeScript (strict mode) on React 19 + React 19, WXT, @tanstack/react-virtual, lucide-react, Tailwind CSS v4 (019-query-mutation-sorting)
- N/A (ephemeral in-memory state only) (019-query-mutation-sorting)
- TypeScript (strict mode) + React 19.2 + React 19, @tanstack/react-virtual 3.13, WXT 0.20, Tailwind CSS v4 (020-filter-relative-time)
- N/A (in-memory UI state only) (020-filter-relative-time)
- TypeScript (strict mode), React 19 + WXT (web extension framework), Tailwind CSS v4 (`@tailwindcss/vite`), `@tanstack/query-core`, `lucide-react`, `highlight.js`, `@tanstack/react-virtual` (to be removed) (021-ui-layout-fixes)
- N/A (no storage changes in this feature) (021-ui-layout-fixes)
- TypeScript 5.9 (strict mode) + React 19, WXT (web extension framework), @tanstack/query-core (022-action-button-fetch-state)
- N/A (in-memory state synced via message passing) (022-action-button-fetch-state)

- TypeScript 5.9 (strict mode) + React 19, WXT 0.20, Tailwind CSS v4, highlight.js 11, lucide-react, @tanstack/query-core (001-setup-connection-message)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.9 (strict mode): Follow standard conventions

## Recent Changes
- 022-action-button-fetch-state: Added TypeScript 5.9 (strict mode) + React 19, WXT (web extension framework), @tanstack/query-core
- 021-ui-layout-fixes: Added TypeScript (strict mode), React 19 + WXT (web extension framework), Tailwind CSS v4 (`@tailwindcss/vite`), `@tanstack/query-core`, `lucide-react`, `highlight.js`, `@tanstack/react-virtual` (to be removed)
- 020-filter-relative-time: Added TypeScript (strict mode) + React 19.2 + React 19, @tanstack/react-virtual 3.13, WXT 0.20, Tailwind CSS v4


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
