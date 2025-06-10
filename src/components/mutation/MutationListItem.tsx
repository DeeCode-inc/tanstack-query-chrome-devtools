import { useState } from "react";
import { StatusBadge } from "../status/StatusBadge";
import { getMutationStatusDisplay } from "../../utils/status";
import type { MutationData } from "../../types/query";

// Chevron down icon component
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

interface MutationListItemProps {
  mutation: MutationData;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  staggerIndex?: number;
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

export function MutationListItem({
  mutation,
  index,
  isSelected,
  onSelect,
  staggerIndex,
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
}: MutationListItemProps) {
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
        {/* Status indicator */}
        <StatusBadge status={status} />

        {/* Mutation info and expand trigger area */}
        <div className="card-expand-trigger">
          <div className="flex-1">
            <div className="font-mono query-key-responsive text-gray-700 dark:text-gray-300 truncate">
              {mutation.mutationKey || `Mutation #${mutation.mutationId}`}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {new Date(mutation.submittedAt).toLocaleTimeString()}
            </div>
          </div>

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
            <span>Submitted: {new Date(mutation.submittedAt).toLocaleTimeString()}</span>
            <span>Status: {mutation.state}</span>
            <span>Pending: {mutation.isPending ? "Yes" : "No"}</span>
          </div>

          {mutation.variables !== undefined && (
            <div>
              <div className="card-preview-header">Variables</div>
              <div className="card-preview-data">
                <pre>{formatDataPreview(mutation.variables)}</pre>
              </div>
            </div>
          )}

          {mutation.data !== undefined && (
            <div className="mt-3">
              <div className="card-preview-header">Result</div>
              <div className="card-preview-data">
                <pre>{formatDataPreview(mutation.data)}</pre>
              </div>
            </div>
          )}

          {!!mutation.error && (
            <div className="mt-3">
              <div className="card-preview-header">Error</div>
              <div className="card-preview-data text-red-600 dark:text-red-400">
                <pre>{(mutation.error as Error)?.message || String(mutation.error)}</pre>
              </div>
            </div>
          )}

          <div className="mt-3 text-xs text-gray-400 dark:text-gray-500 italic">Double-click to open full details panel</div>
        </div>
      )}
    </div>
  );
}

export default MutationListItem;
