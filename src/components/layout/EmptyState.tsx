export function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-lg mx-auto p-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-center">
        <div className="text-4xl mb-4">🔌</div>
        <h3 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">Connect Your App</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">To use TanStack Query DevTools, add this line to your application:</p>
        <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-3 mb-4">
          <code className="text-sm font-mono text-gray-800 dark:text-gray-200">window.__TANSTACK_QUERY_CLIENT__ = queryClient</code>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Place this code where you create your QueryClient instance, typically in your app setup or main component.</p>
      </div>
    </div>
  );
}
