import type { QueryClient } from "@tanstack/query-core";

declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__: QueryClient | undefined;
  }
}
