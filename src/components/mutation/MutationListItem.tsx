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
  // Keyboard navigation props
  isFocused?: boolean;
  isKeyboardFocused?: boolean;
  tabIndex?: number;
  onFocus?: () => void;
  onMouseEnter?: () => void;
  itemRef?: (element: HTMLElement | null) => void;
}

export function MutationListItem({ mutation, index, isSelected, onSelect, staggerIndex, isFocused = false, isKeyboardFocused = false, tabIndex = -1, onFocus, onMouseEnter, itemRef }: MutationListItemProps) {
  const status = getMutationStatusDisplay(mutation);
  const [staggerAnimationComplete, setStaggerAnimationComplete] = useState(false);

  // Apply stagger animation if staggerIndex is provided
  const staggerStyle =
    staggerIndex !== undefined
      ? ({
          "--stagger-index": staggerIndex,
        } as React.CSSProperties)
      : {};

  // Handle animation end to remove stagger class
  const handleAnimationEnd = (event: React.AnimationEvent) => {
    if (event.animationName === "list-item-enter") {
      setStaggerAnimationComplete(true);
    }
  };

  // Handle simple click to select
  const handleCardClick = () => {
    onSelect(index);
  };

  return (
    <div
      ref={itemRef}
      style={staggerStyle}
      onAnimationEnd={handleAnimationEnd}
      onFocus={onFocus}
      onMouseEnter={onMouseEnter}
      tabIndex={tabIndex}
      className={`
        card-list-item card-list-item-animated card-selection-animated
        ${isSelected ? "card-selected" : ""}
        ${isFocused ? "card-focused" : ""}
        ${isKeyboardFocused ? "card-keyboard-focused" : ""}
        ${staggerIndex !== undefined && !staggerAnimationComplete ? "list-item-stagger" : ""}
      `}
    >
      {/* Simple card content */}
      <div onClick={handleCardClick} className="flex items-center gap-3">
        {/* Status indicator */}
        <StatusBadge status={status} />

        {/* Mutation info */}
        <div className="flex-1">
          <div className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">{mutation.mutationKey || `Mutation #${mutation.mutationId}`}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{new Date(mutation.submittedAt).toLocaleTimeString()}</div>
        </div>
      </div>
    </div>
  );
}
