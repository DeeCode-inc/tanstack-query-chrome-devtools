# TanStack Query Chrome DevTools

A professional Chrome DevTools extension for debugging TanStack Query applications across all frameworks.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-blue?style=flat-square&logo=google-chrome)](https://chromewebstore.google.com/detail/tanstack-query-devtools/annajfchloimdhceglpgglpeepfghfai)

## ✨ Features

### 🔍 Advanced Debugging Capabilities

- **Real-time Query Inspection** - Live monitoring of all queries and mutations with instant state updates
- **Interactive Data Editing** - Edit query data directly in DevTools using professional JsonView interface
- **State Manipulation** - Trigger loading and error states for comprehensive UI testing
- **Complete Cache Management** - Invalidate, refetch, reset, and remove queries with one-click actions
- **Mutation Tracking** - Monitor mutations with variables, status, and result inspection

![TanStack Query DevTools Screenshot](store-assets/screenshots/screenshot-1280x800.png)

## Quick Start

1. **Install** the extension from [Chrome Web Store](https://chromewebstore.google.com/detail/tanstack-query-devtools/annajfchloimdhceglpgglpeepfghfai)
2. **Setup your application** to expose the query client globally:

   ```typescript
   // Add this line where you create your query client
   window.__TANSTACK_QUERY_CLIENT__ = queryClient;
   ```

3. **For TypeScript projects**, create a `global.d.ts` file in your project root:

   ```typescript
   interface Window {
     __TANSTACK_QUERY_CLIENT__: import("@tanstack/query-core").QueryClient;
   }
   ```

4. **Open** Chrome DevTools (F12) in your application
5. **Navigate** to the "TanStack Query" tab
6. **Start debugging** with real-time query inspection!

## 🏗️ Technical Architecture

### Multi-Context Extension Pattern

```
Web Application (TanStack Query)
    ↓ Detection & State Extraction
Injected Script (Application Context)
    ↓ Message Passing
Content Script (Bridge)
    ↓ Chrome APIs
Background Service Worker
    ↓ DevTools Connection
React DevTools Panel
```

## 🔧 Development

### Local Development Setup

```bash
# Install dependencies
npm install

# Build extension
npm run build

# Load extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `dist` folder
```

## 🔗 Links

- [Chrome Web Store](https://chromewebstore.google.com/detail/tanstack-query-devtools/annajfchloimdhceglpgglpeepfghfai)
- [TanStack Query Documentation](https://tanstack.com/query)
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)
