import { CodeBlock } from "../common/CodeBlock";

export function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center overflow-hidden">
      <div className="overflow-auto max-h-full max-w-lg mx-auto p-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-center enter-animation">
        <div className="mb-4">
          <img
            src="/icon-48.png"
            alt="TanStack Query DevTools"
            className="w-12 h-12 mx-auto"
          />
        </div>
        <h3 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
          Connect Your App
        </h3>
        <div className="text-left">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            To use TanStack Query DevTools, add this code to your application
            where you create your QueryClient:
          </p>

          <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-3">
            <CodeBlock
              code={`const queryClient = new QueryClient({/* ... */});

// This code is only for TypeScript
declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__:
      import("@tanstack/query-core").QueryClient;
  }
}

// This code is for all users
window.__TANSTACK_QUERY_CLIENT__ = queryClient;`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
