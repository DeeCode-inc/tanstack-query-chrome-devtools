import { ExtensionIcon } from "./ExtensionIcon";

interface SyncStatusMessageProps {
  readonly title: string;
  readonly detail: string;
  /** Announced to assistive technology as soon as it appears. */
  readonly alert?: boolean;
}

/** A card in place of the lists, for a tab whose caches cannot be shown yet. */
export function SyncStatusMessage({
  title,
  detail,
  alert = false,
}: SyncStatusMessageProps) {
  return (
    <div
      role={alert ? "alert" : "status"}
      className="w-full max-w-xl rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm"
    >
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <ExtensionIcon />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
          {detail}
        </p>
      </div>
    </div>
  );
}
