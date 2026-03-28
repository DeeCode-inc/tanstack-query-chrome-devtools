import { ExtensionIcon } from "./ExtensionIcon";

export function StubMessage() {
  return (
    <div className="w-full max-w-xl rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm">
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <ExtensionIcon />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Connected
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          TanStack Query client detected. DevTools coming soon.
        </p>
      </div>
    </div>
  );
}
