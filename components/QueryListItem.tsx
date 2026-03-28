import type { QueryEntry } from "@/types/ui";
import { STATUS_THEMES } from "@/utils/status-theme";
import { stringifyWithBigInt } from "@/utils/serialization";

interface QueryListItemProps {
  readonly query: QueryEntry;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
}

export function QueryListItem({ query, isSelected, onSelect }: QueryListItemProps) {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer ${
        isSelected
          ? "bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-600"
          : "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent"
      }`}
    >
      <span className={`inline-flex items-center justify-center size-6 rounded border text-xs font-medium shrink-0 ${STATUS_THEMES[query.status].bg} ${STATUS_THEMES[query.status].text} ${STATUS_THEMES[query.status].border}`}>
        {query.observerCount}
      </span>
      <span className="font-mono text-xs text-gray-900 dark:text-gray-100 break-all">
        {stringifyWithBigInt(query.queryKey)}
      </span>
      {!query.isActive && query.observerCount > 0 && (
        <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          Disabled
        </span>
      )}
    </div>
  );
}
