# TanStack Query DevTools

<p align="center">
  <img src="public/icon/icon-128.png" alt="TanStack Query DevTools" width="128" height="128" />
</p>

<p align="center">
  A browser extension for debugging <a href="https://tanstack.com/query">TanStack Query</a> applications.<br/>
  Inspect queries, mutations, and cache state — in real time.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/tanstack-query-devtools/annajfchloimdhceglpgglpeepfghfai"><img src="https://img.shields.io/badge/Chrome-Web%20Store-4285F4?logo=googlechrome" alt="Chrome Web Store" /></a>
  <a href="https://addons.mozilla.org/en-US/firefox/addon/tanstack-query-devtools/"><img src="https://img.shields.io/badge/Firefox-Add--ons-FF7139?logo=firefox" alt="Firefox Add-ons" /></a>
  <a href="https://microsoftedge.microsoft.com/addons/detail/tanstack-query-devtools/edmdpkgkacmjopodhfolmphdenmddobj"><img src="https://img.shields.io/badge/Edge-Add--ons-0078D7?logo=microsoftedge" alt="Edge Add-ons" /></a>
</p>

---

## Features

- **Live query & mutation inspection** — see every query and mutation in your app update in real time
- **Detailed view** — drill into individual queries and mutations to see their status, data, and metadata
- **Data tree viewer** — explore query/mutation data as an interactive, expandable tree
- **Inline data editing** — modify cached query data directly from the devtools
- **Cache actions** — invalidate, refetch, reset, or remove queries; clear the mutation cache
- **Status badges** — at-a-glance status indicators (fresh, stale, fetching, paused, inactive, error)
- **Search & sort** — filter queries/mutations by key and sort by key, status, or last updated time
- **Popup & DevTools panel** — use as a standalone popup or as a panel inside browser DevTools
- **Cross-browser** — works on Chrome, Firefox, and Edge

## Quick Start

### Install from a store

Install directly from one of the browser add-on stores:

- [Chrome Web Store](https://chromewebstore.google.com/detail/tanstack-query-devtools/annajfchloimdhceglpgglpeepfghfai)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tanstack-query-devtools/)
- [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tanstack-query-devtools/edmdpkgkacmjopodhfolmphdenmddobj)

### Usage

#### 1. Expose your QueryClient on the window

The extension connects to your app by reading `window.__TANSTACK_QUERY_CLIENT__`. Add this to your app's entry point (e.g. `main.ts` / `main.tsx`):

```typescript
const queryClient = new QueryClient({
  /* ... */
});

// TypeScript users: add the type declaration
declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__: import("@tanstack/query-core").QueryClient;
  }
}

window.__TANSTACK_QUERY_CLIENT__ = queryClient;
```

#### 2. Open the extension

1. Navigate to your app in the browser.
2. The extension icon in the toolbar turns **colored** when a `QueryClient` is detected.
3. Click the icon to open the **popup**, or open **DevTools → TanStack Query** panel for the full experience.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [pnpm](https://pnpm.io/), [npm](https://www.npmjs.com/), or [yarn](https://yarnpkg.com/)

### Setup

```bash
# Clone the repo
git clone https://github.com/DeeCode-inc/tanstack-query-chrome-devtools.git
cd tanstack-query-chrome-devtools

# Install dependencies
npm install

# Start dev server (Chrome)
npm run dev

# Start dev server (Firefox)
npm run dev:firefox
```

### Build

```bash
# Production build (Chrome)
npm run build

# Production build (Firefox)
npm run build:firefox

# Package as .zip for store submission
npm run zip
npm run zip:firefox
```

### Other scripts

| Command                   | Description                |
| ------------------------- | -------------------------- |
| `npm run lint`            | Run ESLint                 |
| `npm run prettier:check`  | Check formatting           |
| `npm run prettier:format` | Auto-format all files      |
| `npm run compile`         | Type-check with TypeScript |

## Tech Stack

- [WXT](https://wxt.dev/) — next-gen browser extension framework
- [React 19](https://react.dev/) — UI
- [Tailwind CSS 4](https://tailwindcss.com/) — styling
- [TypeScript](https://www.typescriptlang.org/) — type safety
- [@tanstack/query-core](https://tanstack.com/query) — query type definitions

## Architecture

The extension consists of three main parts:

| Component                     | Description                                                            |
| ----------------------------- | ---------------------------------------------------------------------- |
| **Content scripts**           | Injected into web pages to detect TanStack Query and relay cache state |
| **Background service worker** | Routes messages between content scripts and UI surfaces                |
| **UI (Panel / Popup)**        | React app that renders the devtools interface                          |

Data flows from the page's `QueryClient` through content scripts → background → panel/popup via port-based messaging with snapshot + incremental update semantics.

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

---

<p align="center">
  Built by <a href="https://github.com/DeeCode-inc">Dmytro Borysov</a>
</p>
