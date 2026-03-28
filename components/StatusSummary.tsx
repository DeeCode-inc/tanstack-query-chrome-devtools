import type { StatusDefinition } from "@/utils/status-theme";
import { STATUS_THEMES } from "@/utils/status-theme";

interface StatusSummaryProps<T> {
  readonly items: readonly T[];
  readonly getStatus: (item: T) => string;
  readonly statusDefinitions: readonly StatusDefinition[];
}

export function StatusSummary<T>({ items, getStatus, statusDefinitions }: StatusSummaryProps<T>) {
  return (
    <div className="flex items-center gap-1.5">
      {statusDefinitions.map((def) => {
        const count = items.filter((item) => getStatus(item) === def.key).length;
        const theme = count > 0 ? def.theme : STATUS_THEMES.inactive;
        return (
          <div
            key={def.key}
            title={def.label}
            className="flex items-center gap-3 px-1.5 py-0.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          >
            <span
              className={`size-2 rounded-full ${def.theme.dot}`}
            />
            <span className="hidden @[650px]:inline text-xs text-gray-600 dark:text-gray-400">
              {def.label}
            </span>
            <span
              className={`size-5 rounded text-xs font-medium flex items-center justify-center border ${theme.bg} ${theme.text} ${theme.border}`}
            >
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
