import { useState } from "react";
import { StatusBadge } from "../status/StatusBadge";
import { getMutationStatusDisplay } from "../../utils/status";
import type { MutationData } from "../../types/query";

interface MutationListItemProps {
  mutation: MutationData;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  staggerIndex?: number;
}

export function MutationListItem({ mutation, index, isSelected, onSelect, staggerIndex }: MutationListItemProps) {
  const status = getMutationStatusDisplay(mutation);
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
      {/* Status indicator */}
      <StatusBadge status={status} />

      {/* Mutation info - responsive sizing with container queries */}
      <div className="flex-1">
        <div className="font-mono query-key-responsive text-gray-700 dark:text-gray-300 truncate">
          {mutation.mutationKey || `Mutation #${mutation.mutationId}`}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {new Date(mutation.submittedAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

export default MutationListItem;
