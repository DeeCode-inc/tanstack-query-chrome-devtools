import { useState } from "react";
import { StatusBadge } from "../status/StatusBadge";
import { getQueryStatusDisplay } from "../../utils/status";
import { formatQueryKeyShort } from "../../utils/formatters";
import type { QueryData } from "../../types/query";

interface QueryListItemProps {
  query: QueryData;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  staggerIndex?: number;
}

export function QueryListItem({ query, index, isSelected, onSelect, staggerIndex }: QueryListItemProps) {
  const status = getQueryStatusDisplay(query);
  const [staggerAnimationComplete, setStaggerAnimationComplete] = useState(false);

  // Apply stagger animation if staggerIndex is provided
  const staggerStyle = staggerIndex !== undefined ? {
    '--stagger-index': staggerIndex
  } as React.CSSProperties : {};

  // Handle animation end to remove stagger class
  const handleAnimationEnd = (event: React.AnimationEvent) => {
    if (event.animationName === 'list-item-enter') {
      setStaggerAnimationComplete(true);
    }
  };

  return (
    <div
      onClick={() => onSelect(index)}
      style={staggerStyle}
      onAnimationEnd={handleAnimationEnd}
      className={`
        card-list-item card-list-item-animated card-selection-animated query-item-responsive
        flex items-center gap-3
        ${isSelected ? "card-selected" : ""}
        ${staggerIndex !== undefined && !staggerAnimationComplete ? "list-item-stagger" : ""}
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
