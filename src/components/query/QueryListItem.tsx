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
        card-list-item card-list-item-animated card-selection-animated query-item-responsive
        flex items-center gap-3
        ${isSelected ? "card-selected" : ""}
      `}
    >
      {/* Observer count badge */}
      <StatusBadge status={status} count={query.observersCount} />

      {/* Query key - responsive sizing with container queries */}
      <div className="flex-1 font-mono query-key-responsive text-gray-700 dark:text-gray-300 truncate">
        {formatQueryKeyShort(query.queryKey)}
      </div>
    </div>
  );
}

export default QueryListItem;
