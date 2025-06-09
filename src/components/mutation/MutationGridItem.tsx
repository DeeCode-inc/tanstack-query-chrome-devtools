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

interface MutationGridItemProps {
  mutation: MutationData;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  staggerIndex?: number;
  isExpanded?: boolean;
  onToggleExpand?: (index: number) => void;
}

export function MutationGridItem({
  mutation,
  index,
  isSelected,
  onSelect,
  staggerIndex,
  isExpanded = false,
  onToggleExpand
}: MutationGridItemProps) {
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

  // Handle main card click (single click to expand, double click to select)
  const handleCardClick = (event: React.MouseEvent) => {
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
      // Truncate if too long for grid view
      if (str.length > 150) {
        return str.substring(0, 150) + "...";
      }
      return str;
    } catch {
      return String(data);
    }
  };

  return (
    <div
      style={staggerStyle}
      onAnimationEnd={handleAnimationEnd}
      onClick={handleCardClick}
      className={`
        card-grid-item card-list-item-animated card-selection-animated card-expandable
        ${isSelected ? "card-grid-item-selected" : ""}
        ${isExpanded ? "card-grid-item-expanded" : ""}
        ${staggerIndex !== undefined && !staggerAnimationComplete ? "list-item-stagger" : ""}
      `}
    >
      {/* Grid item header */}
      <div className="card-grid-header">
        <div className="flex items-center gap-3 mb-2">
          <StatusBadge status={status} />
          {onToggleExpand && (
            <button
              onClick={handleExpandToggle}
              className="card-expand-button ml-auto"
              aria-label={isExpanded ? "Collapse preview" : "Expand preview"}
            >
              <ChevronDownIcon className={`card-expand-icon ${isExpanded ? "card-expand-icon-expanded" : ""}`} />
            </button>
          )}
        </div>
        <div className="font-mono text-sm text-gray-700 dark:text-gray-300 truncate">
          {mutation.mutationKey || `Mutation #${mutation.mutationId}`}
        </div>
      </div>

      {/* Grid item content */}
      <div className="card-grid-content">
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>Submitted: {new Date(mutation.submittedAt).toLocaleTimeString()}</span>
          <span>Status: {mutation.state}</span>
        </div>

        {isExpanded && (
          <div className="card-grid-preview">
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
          </div>
        )}
      </div>

      {/* Grid item footer */}
      {isExpanded && (
        <div className="card-grid-footer">
          <div className="text-xs text-gray-400 dark:text-gray-500 italic text-center">
            Double-click to open full details panel
          </div>
        </div>
      )}
    </div>
  );
}

export default MutationGridItem;
