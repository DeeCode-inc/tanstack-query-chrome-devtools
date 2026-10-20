import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import type { StatusTheme } from "@/utils/status-theme";

interface DetailHeaderProps {
  readonly title: string;
  /** Caption above the key, e.g. `Query key:`. */
  readonly keyLabel: string;
  /** Pre-formatted key text shown in the key box. */
  readonly keyText: string;
  readonly status: string;
  readonly theme: StatusTheme;
  readonly onBack?: () => void;
  /** Meta lines shown under the key box (observers, timestamps). */
  readonly children?: ReactNode;
}

/**
 * Top of a detail view: optional back button, sticky title, key box with a
 * status badge, and meta lines. Renders as a fragment so its sticky parts
 * stick within the caller's scroll container.
 */
export function DetailHeader({
  title,
  keyLabel,
  keyText,
  status,
  theme,
  onBack,
  children,
}: DetailHeaderProps) {
  return (
    <>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="sticky top-0 bg-white z-11 dark:bg-gray-900 flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
      )}

      <h2 className="sticky bg-white dark:bg-gray-900 px-4 pt-3 pb-1 top-0 z-10 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h2>

      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-1">
        <div className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {keyLabel}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize border ${theme.bg} ${theme.text} ${theme.border}`}
            >
              {status}
            </span>
          </div>
          <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-all font-mono">
            {keyText}
          </pre>
        </div>
        {children}
      </div>
    </>
  );
}
