import { CodeBlock } from "../common/CodeBlock";
import { Collapsible } from "../common/Collapsible";

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
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          To use TanStack Query DevTools, add this line to your application:
        </p>
        <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-3 mb-4">
          <CodeBlock
            code="window.__TANSTACK_QUERY_CLIENT__ = queryClient;"
            language="javascript"
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Place this code where you create your QueryClient instance, typically
          in your app setup or main component.
        </p>

        <Collapsible
          title="TypeScript Users"
          className="text-left bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3"
        >
          <div className="mt-3 space-y-3">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              If you're using TypeScript, you'll also need to create a{" "}
              <code className="bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded text-xs font-mono">
                global.d.ts
              </code>{" "}
              file in your project root with the following declaration:
            </p>
            <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-3">
              <CodeBlock
                code={`interface Window {
  __TANSTACK_QUERY_CLIENT__:
    import("@tanstack/query-core")
      .QueryClient;
}`}
                language="typescript"
              />
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              This type declaration allows TypeScript to recognize the global
              property and prevents compilation errors.
            </p>
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
