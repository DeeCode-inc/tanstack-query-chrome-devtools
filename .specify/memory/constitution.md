<!--
  Sync Impact Report
  ==================
  Version change: 1.0.0 → 1.1.0 (MINOR — removal of unconditional virtualization MUST within Principle III)
  Modified principles:
    - III. Performance: removed "MUST use virtualized lists or pagination" bullet;
      replaced with "SHOULD prefer plain scrollable lists; MAY virtualize only on profiled evidence"
  Added sections: none
  Removed sections: none
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no virtualization references found
    - .specify/templates/spec-template.md ✅ no virtualization references found
    - .specify/templates/tasks-template.md ✅ no virtualization references found
    - .github/agents/copilot-instructions.md ✅ @tanstack/react-virtual entries are per-feature
      historical records, not governance rules — no update required
  Follow-up TODOs:
    - TODO(RATIFICATION_DATE): original v1.0.0 ratification date not recorded; add when known
      → UPDATE: ratification date recovered as 2026-03-14
-->

# TanStack Query DevTools Constitution

## Core Principles

### I. Cross-Browser Compatibility (NON-NEGOTIABLE)

- The extension MUST work on Chrome, Firefox, and Edge.
- All browser-specific APIs MUST be accessed through the WXT/webextension
  polyfill abstraction layer; direct `chrome.*` calls are forbidden.
- Every feature MUST be manually verified on all three browsers before
  it is considered complete.
- Manifest differences (MV2 for Firefox, MV3 for Chromium) MUST be
  handled via WXT's built-in browser targets, not manual manifest
  patching.

### II. Security

- Only well-established, actively-maintained npm packages with
  significant community adoption MAY be added as dependencies.
- Before adding any new dependency, its necessity MUST be justified;
  if the functionality can be achieved with existing dependencies or
  a small amount of custom code, that approach MUST be preferred.
- All messages exchanged between content script, background script,
  and DevTools panel MUST use structured, validated schemas—never
  raw `eval`, `innerHTML`, or unsanitized string interpolation.
- Content Security Policy (CSP) MUST remain strict; inline scripts
  and `unsafe-eval` are forbidden.

### III. Performance

- This extension operates on asynchronous events emitted to/from the
  host page. No redundant or duplicate events MAY be emitted.
- Message payloads MUST be as small as possible: send only the data
  the consumer needs, never the full query cache when a delta suffices.
- Expensive operations (serialization, diffing, filtering) MUST NOT
  block the main thread of the inspected page.
- Plain scrollable lists (`.map()`) SHOULD be preferred for
  query/mutation list rendering in the DevTools panel. Virtualization
  MAY be introduced only when profiling confirms concrete
  layout-thrashing or rendering bottlenecks with actual data volumes;
  the extension's typical workload (< ~100 items) does not warrant the
  added complexity.

### IV. Type Safety (NON-NEGOTIABLE)

- `any`, `unknown` (except at validated boundaries), `Function`, and
  other overly-broad types are forbidden throughout the codebase.
- Every function parameter, return type, and message payload MUST have
  an explicit, narrow TypeScript type.
- The `strict` family of `tsconfig` flags MUST remain enabled;
  `// @ts-ignore` and `// @ts-expect-error` require a justifying
  comment explaining why the suppression is necessary and a tracking
  issue for removal.
- Generic utility types MUST be preferred over type assertions.

### V. Theming

- The extension MUST support both dark and light themes.
- Theme selection MUST respect the user's system preference
  (`prefers-color-scheme`) by default, with an optional manual
  override stored in extension local storage.
- All color values MUST be expressed as Tailwind CSS theme tokens or
  CSS custom properties—hard-coded hex/rgb values are forbidden.

### VI. Tailwind-First Styling

- Custom CSS files and inline style attributes MUST be avoided.
  Tailwind utility classes are the primary styling mechanism.
- When a UI pattern is used in more than one place, it MUST be
  extracted into a reusable React component with Tailwind classes,
  not a shared CSS class.
- The only permitted custom CSS is Tailwind's `@theme` / base-layer
  configuration in `assets/tailwind.css`.

### VII. Service Worker Stability

- The background service worker MUST either remain persistently
  active (where the browser permits) or implement a robust recovery
  mechanism that restores state after the worker is terminated.
- All critical state MUST be persisted to `browser.storage.session`
  or `browser.storage.local` so it survives worker restarts.
- Connection lifecycle (port connect/disconnect between DevTools
  panel, content script, and background) MUST be explicitly managed
  with reconnection logic and clear error reporting.

### VIII. Data Type Coverage

- The extension MUST correctly serialize, deserialize, and display
  all JavaScript value types that can appear in a TanStack Query
  cache, including but not limited to: `bigint`, `Date`, `Map`,
  `Set`, `undefined`, `NaN`, `Infinity`, `-Infinity`, `RegExp`,
  `ArrayBuffer`, and typed arrays.
- A custom structured-clone-aware serializer MUST be used instead of
  `JSON.stringify` for any data that may contain non-JSON-safe types.
- The display layer MUST render each type with a distinguishable
  visual representation (e.g., `123n` for bigint, formatted dates
  for `Date`).

## Technology Stack & Constraints

- **Framework**: React 19 + WXT (web extension framework)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Query Core**: `@tanstack/query-core` for type definitions and
  cache introspection
- **Icons**: `lucide-react`
- **Syntax Highlighting**: `highlight.js`
- **Linting**: ESLint 9 flat config with `typescript-eslint`
- **Build Targets**: Chrome (MV3), Firefox (MV2/3), Edge (MV3)
- **Minimum Browser Versions**: last 2 major versions of each target
- **No additional runtime dependencies** without explicit
  justification per Principle II.

## Development Workflow

- `wxt` for development (`npm run dev` / `npm run dev:firefox`)
- `wxt build` for production builds
- `tsc --noEmit` for type checking (`npm run compile`)
- `eslint .` for linting (`npm run lint`)
- `prettier` for formatting (`npm run prettier:format`)
- All PRs MUST pass `compile`, `lint`, and `prettier:check` before
  merge.
- Every new UI component MUST be verified in both dark and light
  themes on at least Chrome and Firefox.

## Governance

- This constitution is the authoritative source of project-wide
  engineering principles. It supersedes ad-hoc decisions and
  informal conventions.
- Any amendment MUST be documented with a version bump, a rationale,
  and an updated Sync Impact Report at the top of this file.
- Version follows semantic versioning: MAJOR for principle removals
  or incompatible redefinitions, MINOR for new principles or
  material expansions, PATCH for clarifications and typo fixes.
- All code reviews MUST verify compliance with these principles.
  Violations require either a fix or a documented, time-bound
  exception with a tracking issue.

**Version**: 1.1.0 | **Ratified**: 2026-03-14 | **Last Amended**: 2026-03-24
