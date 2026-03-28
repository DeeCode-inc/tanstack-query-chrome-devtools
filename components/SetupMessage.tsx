import { ExtensionIcon } from "./ExtensionIcon";
import { CodeSnippet } from "./CodeSnippet";
import type { LayoutVariant } from "@/types/ui";

const SETUP_CODE = `const queryClient = new QueryClient({/* ... */})

// This code is only for TypeScript
declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__:
      import('@tanstack/query-core').QueryClient
  }
}

// This code is for all users
window.__TANSTACK_QUERY_CLIENT__ = queryClient`

const SETUP_CODE_COMPACT = `const queryClient = new QueryClient()

// TypeScript only:
declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__:
      import('@tanstack/query-core')
        .QueryClient
  }
}

window.__TANSTACK_QUERY_CLIENT__ = queryClient`

interface SetupMessageProps {
  variant?: LayoutVariant;
}

export function SetupMessage({ variant = "panel" }: SetupMessageProps) {
  if (variant === "popup") {
    return (
      <div className="flex flex-col items-center gap-4 p-2 text-center w-full">
        <ExtensionIcon />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Connect Your App
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
          To use TanStack Query DevTools, add this code to your application where you create your QueryClient.
        </p>
        <div className="w-full text-left">
          <CodeSnippet code={SETUP_CODE_COMPACT} language="typescript" preClassName="text-xs" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm">
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <ExtensionIcon />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Connect Your App
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
          To use TanStack Query DevTools, add this code to your application where you create your QueryClient.
        </p>
        <div className="w-full max-w-lg text-left">
          <CodeSnippet code={SETUP_CODE} language="typescript" />
        </div>
      </div>
    </div>
  );
}
