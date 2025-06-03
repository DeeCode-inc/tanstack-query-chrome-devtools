/// <reference types="vite/client" />

// Extend Window interface for TanStack Query DevTools
declare global {
  interface Window {
    queryClient?: unknown;
    __TANSTACK_QUERY_CLIENT__?: unknown;
    __TANSTACK_QUERY_DEVTOOLS_INJECTED__?: boolean;
  }
}

export {}
