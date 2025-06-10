import { useState } from 'react';
import type { BulkActionOptions } from '../../types/query';

interface SelectionIndicatorProps {
  selectedCount: number;
  totalCount: number;
  onBulkAction: (action: BulkActionOptions) => void;
  onClearSelection: () => void;
  onSelectAll: () => void;
  viewType: 'queries' | 'mutations';
}

// Icons components
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function ResetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

export function SelectionIndicator({
  selectedCount,
  totalCount,
  onBulkAction,
  onClearSelection,
  onSelectAll,
  viewType
}: SelectionIndicatorProps) {
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  if (selectedCount === 0) {
    return null;
  }

  const selectedIndices = Array.from({ length: selectedCount }, (_, i) => i); // This will be passed from parent

  const handleBulkAction = async (action: BulkActionOptions['action']) => {
    setIsProcessing(action);

    try {
      await onBulkAction({
        action,
        targetIndices: selectedIndices,
      });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="multi-selection-indicator">
      <div className="multi-selection-header">
        <div className="multi-selection-info">
          <CheckIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {selectedCount} {viewType} selected
          </span>
          {selectedCount < totalCount && (
            <button
              onClick={onSelectAll}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline ml-2"
            >
              Select all {totalCount}
            </button>
          )}
        </div>

        <button
          onClick={onClearSelection}
          className="multi-selection-clear"
          aria-label="Clear selection"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="multi-selection-actions">
        {/* Refetch action - available for both queries and mutations */}
        <button
          onClick={() => handleBulkAction('refetch')}
          disabled={isProcessing === 'refetch'}
          className="btn-secondary btn-animated text-xs"
          title={`Refetch ${selectedCount} ${viewType}`}
        >
          <RefreshIcon className="w-3 h-3" />
          {isProcessing === 'refetch' ? 'Refetching...' : 'Refetch'}
        </button>

        {/* Query-specific actions */}
        {viewType === 'queries' && (
          <>
            <button
              onClick={() => handleBulkAction('invalidate')}
              disabled={isProcessing === 'invalidate'}
              className="btn-warning btn-animated text-xs"
              title={`Invalidate ${selectedCount} queries`}
            >
              <RefreshIcon className="w-3 h-3" />
              {isProcessing === 'invalidate' ? 'Invalidating...' : 'Invalidate'}
            </button>

            <button
              onClick={() => handleBulkAction('reset')}
              disabled={isProcessing === 'reset'}
              className="btn-accent btn-animated text-xs"
              title={`Reset ${selectedCount} queries`}
            >
              <ResetIcon className="w-3 h-3" />
              {isProcessing === 'reset' ? 'Resetting...' : 'Reset'}
            </button>
          </>
        )}

        {/* Remove action - available for both */}
        <button
          onClick={() => handleBulkAction('remove')}
          disabled={isProcessing === 'remove'}
          className="btn-danger btn-animated text-xs"
          title={`Remove ${selectedCount} ${viewType}`}
        >
          <TrashIcon className="w-3 h-3" />
          {isProcessing === 'remove' ? 'Removing...' : 'Remove'}
        </button>
      </div>
    </div>
  );
}
