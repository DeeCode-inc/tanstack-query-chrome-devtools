/// <reference types="vite/client" />

import type { QueryClient } from '@tanstack/query-core';

// Extend Window interface for TanStack Query DevTools
declare global {
  interface Window {
    queryClient?: QueryClient;
    __TANSTACK_QUERY_CLIENT__?: QueryClient;
    __TANSTACK_QUERY_DEVTOOLS_INJECTED__?: boolean;
  }
}

export {}
