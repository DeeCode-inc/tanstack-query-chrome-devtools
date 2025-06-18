import { useState } from "react";
import { StatusBadge } from "../status/StatusBadge";
import { Chip } from "../common/Chip";
import { getQueryStatusDisplay } from "../../utils/status";
import { formatQueryKeyShort } from "../../utils/formatters";
import { useStatusTransition } from "../../hooks/useStatusTransition";
import type { QueryData } from "../../types/query";

interface QueryListItemProps {
  query: QueryData;
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

export function QueryListItem({ query, index, isSelected, onSelect, staggerIndex, isFocused = false, isKeyboardFocused = false, tabIndex = -1, onFocus, onMouseEnter, itemRef }: QueryListItemProps) {
  const status = getQueryStatusDisplay(query);
  const [staggerAnimationComplete, setStaggerAnimationComplete] = useState(false);

  // Container animation for status changes
  const { containerClass, handleTransitionEnd: handleStatusTransitionEnd } = useStatusTransition({
    currentStatus: status,
    transitionDuration: 300,
  });

  // Apply stagger animation if staggerIndex is provided
  const staggerStyle =
    staggerIndex !== undefined
      ? ({
          "--stagger-index": staggerIndex,
        } as React.CSSProperties)
      : {};

  // Handle animation end to remove stagger class and status transition
  const handleAnimationEnd = (event: React.AnimationEvent) => {
    if (event.animationName === "list-item-enter") {
      setStaggerAnimationComplete(true);
    } else if (event.animationName === "queryItemStatusChange") {
      handleStatusTransitionEnd();
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
      onClick={handleCardClick}
      className={`
        card-list-item card-list-item-animated card-selection-animated
        ${containerClass}
        ${isSelected ? "card-selected" : ""}
        ${isFocused ? "card-focused" : ""}
        ${isKeyboardFocused ? "card-keyboard-focused" : ""}
        ${staggerIndex !== undefined && !staggerAnimationComplete ? "list-item-stagger" : ""}
      `}
    >
      {/* Simple card content */}
      <div className="flex items-center gap-3">
        {/* Observer count badge with state transition animations */}
        <StatusBadge status={status} count={query.observersCount} transitionDuration={500} />

        {/* Query key */}
        <div className="flex-1 font-mono text-xs text-gray-700 dark:text-gray-300 break-all">{formatQueryKeyShort(query.queryKey)}</div>

        {/* Disabled chip for pending queries */}
        {query.state.status === "pending" && (
          <Chip variant="disabled" size="sm">
            Disabled
          </Chip>
        )}
      </div>
    </div>
  );
}
