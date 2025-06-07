import { StatusBadge } from "../status/StatusBadge";
import { getQueryStatusDisplay } from "../../utils/status";
import { formatQueryKeyShort } from "../../utils/formatters";
import type { QueryData } from "../../types/query";

interface QueryListItemProps {
  query: QueryData;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
}

export function QueryListItem({ query, index, isSelected, onSelect }: QueryListItemProps) {
  const status = getQueryStatusDisplay(query);

  return (
    <div
      onClick={() => onSelect(index)}
      className={`
        p-3 flex items-center gap-3 cursor-pointer border-b border-gray-200 dark:border-gray-600
        transition-colors duration-200 ease-in-out
        ${isSelected ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500" : "hover:bg-gray-50 dark:hover:bg-gray-700"}
      `}
    >
      {/* Observer count badge */}
      <StatusBadge status={status} count={query.observersCount} />

      {/* Query key - single line with truncation */}
      <div className="flex-1 font-mono text-xs text-gray-700 dark:text-gray-300 truncate">
        {formatQueryKeyShort(query.queryKey)}
      </div>
    </div>
  );
}

export default QueryListItem;
