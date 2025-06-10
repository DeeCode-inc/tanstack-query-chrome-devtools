import { useState } from "react";
import { StatusBadge } from "../status/StatusBadge";
import { getQueryStatusDisplay } from "../../utils/status";
import { formatQueryKeyShort } from "../../utils/formatters";
import { useStatusTransition } from "../../hooks/useStatusTransition";
import type { QueryData } from "../../types/query";

// Chevron down icon component
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

interface QueryListItemProps {
  query: QueryData;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  staggerIndex?: number;
  enableCelebration?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (index: number) => void;
  // Multi-selection props
  isMultiSelected?: boolean;
  isRangeSelected?: boolean;
  onMultiSelect?: (index: number, event?: React.MouseEvent) => void;
  // Keyboard navigation props
  isFocused?: boolean;
  isKeyboardFocused?: boolean;
  tabIndex?: number;
  onFocus?: () => void;
  onMouseEnter?: () => void;
  itemRef?: (element: HTMLElement | null) => void;
}

export function QueryListItem({
  query,
  index,
  isSelected,
  onSelect,
  staggerIndex,
  enableCelebration = true,
  isExpanded = false,
  onToggleExpand,
  isMultiSelected = false,
  isRangeSelected = false,
  onMultiSelect,
  isFocused = false,
  isKeyboardFocused = false,
  tabIndex = -1,
  onFocus,
  onMouseEnter,
  itemRef,
}: QueryListItemProps) {
  const status = getQueryStatusDisplay(query);
  const [staggerAnimationComplete, setStaggerAnimationComplete] = useState(false);

  // Container animation for status changes
  const { containerClass, handleTransitionEnd: handleStatusTransitionEnd } = useStatusTransition({
    currentStatus: status,
    transitionDuration: 300,
    enableCelebration,
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

  // Handle expand/collapse toggle
  const handleExpandToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onToggleExpand) {
      onToggleExpand(index);
    }
  };

  // Handle main card click with multi-selection support
  const handleCardClick = (event: React.MouseEvent) => {
    // Check for multi-selection modifiers first
    if (onMultiSelect && (event.ctrlKey || event.metaKey || event.shiftKey)) {
      onMultiSelect(index, event);
      return;
    }

    if (event.detail === 1) {
      // Single click - toggle expand
      if (onToggleExpand) {
        onToggleExpand(index);
      }
    } else if (event.detail === 2) {
      // Double click - select item
      onSelect(index);
    }
  };

  // Format data preview
  const formatDataPreview = (data: unknown) => {
    if (data === null) return "null";
    if (data === undefined) return "undefined";

    try {
      const str = JSON.stringify(data, null, 2);
      // Truncate if too long
      if (str.length > 200) {
        return str.substring(0, 200) + "...";
      }
      return str;
    } catch {
      return String(data);
    }
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
        card-list-item card-list-item-animated card-selection-animated card-expandable
        ${containerClass}
        ${isSelected ? "card-selected" : ""}
        ${isMultiSelected ? "card-multi-selected" : ""}
        ${isRangeSelected ? "card-range-selected" : ""}
        ${isExpanded ? "card-expanded" : ""}
        ${isFocused ? "card-focused" : ""}
        ${isKeyboardFocused ? "card-keyboard-focused" : ""}
        ${staggerIndex !== undefined && !staggerAnimationComplete ? "list-item-stagger" : ""}
      `}
    >
      {/* Main card content */}
      <div onClick={handleCardClick} className="flex items-center gap-3 query-item-responsive">
        {/* Observer count badge with state transition animations */}
        <StatusBadge status={status} count={query.observersCount} enableCelebration={enableCelebration} transitionDuration={500} />

        {/* Query key and expand trigger area */}
        <div className="card-expand-trigger">
          <div className="flex-1 font-mono query-key-responsive text-gray-700 dark:text-gray-300 truncate">{formatQueryKeyShort(query.queryKey)}</div>

          {onToggleExpand && (
            <button onClick={handleExpandToggle} className="card-expand-button" aria-label={isExpanded ? "Collapse preview" : "Expand preview"}>
              <ChevronDownIcon className={`card-expand-icon ${isExpanded ? "card-expand-icon-expanded" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="card-preview-content">
          <div className="card-preview-meta">
            <span>Updated: {new Date(query.state.dataUpdatedAt || Date.now()).toLocaleTimeString()}</span>
            <span>Failures: {query.state.failureCount || 0}</span>
            <span>State: {query.state.fetchStatus || "idle"}</span>
          </div>

          {query.state.data !== undefined ? (
            <div>
              <div className="card-preview-header">Data Preview</div>
              <div className="card-preview-data">
                <pre>{formatDataPreview(query.state.data)}</pre>
              </div>
            </div>
          ) : null}

          {!!query.state.error && (
            <div className="mt-3">
              <div className="card-preview-header">Error</div>
              <div className="card-preview-data text-red-600 dark:text-red-400">
                <pre>{(query.state.error as Error)?.message || String(query.state.error)}</pre>
              </div>
            </div>
          )}

          <div className="mt-3 text-xs text-gray-400 dark:text-gray-500 italic">Double-click to open full details panel</div>
        </div>
      )}
    </div>
  );
}

export default QueryListItem;
