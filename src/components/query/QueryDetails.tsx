import { useState } from "react";
import JsonView from "@microlink/react-json-view";
import type { QueryKey } from "@tanstack/query-core";

import type { QueryData } from "../../types/query";
import { getQueryStatusDisplay } from "../../utils/status";
import { formatQueryKeyShort, formatQueryKeyDetailed, getQueryKeyString } from "../../utils/formatters";

interface QueryDetailsProps {
  selectedQuery: QueryData | null;
  onAction: (action: string, queryKey: QueryKey) => void;
  isDarkMode: boolean;
  artificialStates: Map<string, "loading" | "error">;
}

export function QueryDetails({ selectedQuery, onAction, isDarkMode, artificialStates }: QueryDetailsProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    if (!selectedQuery) return;

    setActionLoading(action);
    try {
      await onAction(action, selectedQuery.queryKey);
    } finally {
      setActionLoading(null);
    }
  };

  if (!selectedQuery) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-2xl mb-2">👈</div>
          <p>Select a query from the list to view details</p>
        </div>
      </div>
    );
  }

  const status = getQueryStatusDisplay(selectedQuery);
  const lastUpdated = Math.max(selectedQuery.state.dataUpdatedAt, selectedQuery.state.errorUpdatedAt);

  // Check artificial states for this query
  const queryKeyString = getQueryKeyString(selectedQuery.queryKey);
  const isArtificialLoading = artificialStates.get(queryKeyString) === "loading";
  const isArtificialError = artificialStates.get(queryKeyString) === "error";

  return (
    <div className="h-full overflow-y-auto">
      {/* Query Details Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Query Details</h3>

        <div className="flex items-start justify-between gap-4 mb-3">
          {/* Query key - multi-line */}
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Query:</div>
            <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-700 p-2 rounded border dark:border-gray-600 text-gray-800 dark:text-gray-200">{formatQueryKeyDetailed(selectedQuery.queryKey)}</pre>
          </div>

          {/* Status badge */}
          <div className="flex-shrink-0">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status:</div>
            <div className={`px-3 py-1 rounded text-white text-sm font-medium ${status.bgColor}`}>{status.text}</div>
          </div>
        </div>

        {/* Observers and Last Updated */}
        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <div>Observers: {selectedQuery.observersCount}</div>
          <div>Last updated: {lastUpdated > 0 ? new Date(lastUpdated).toLocaleTimeString() : "Never"}</div>
        </div>
      </div>

      {/* Actions Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
        <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">Actions</h4>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => handleAction("REFETCH")} disabled={actionLoading !== null} className="px-3 py-2 text-sm font-medium rounded border transition-colors bg-blue-500 text-white border-blue-500 hover:bg-blue-600 disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:disabled:border-gray-600">
            {actionLoading === "REFETCH" ? "Refreshing..." : "Refresh"}
          </button>

          <button onClick={() => handleAction("INVALIDATE")} disabled={actionLoading !== null} className="px-3 py-2 text-sm font-medium rounded border transition-colors bg-yellow-500 text-gray-900 border-yellow-500 hover:bg-yellow-600 disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:disabled:border-gray-600">
            {actionLoading === "INVALIDATE" ? "Invalidating..." : "Invalidate"}
          </button>

          <button onClick={() => handleAction("RESET")} disabled={actionLoading !== null} className="px-3 py-2 text-sm font-medium rounded border transition-colors bg-gray-500 text-white border-gray-500 hover:bg-gray-600 disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:disabled:border-gray-600">
            {actionLoading === "RESET" ? "Resetting..." : "Reset"}
          </button>

          <button
            onClick={() => {
              if (confirm(`Are you sure you want to remove this query from cache?\n\nQuery: ${formatQueryKeyShort(selectedQuery.queryKey)}`)) {
                handleAction("REMOVE");
              }
            }}
            disabled={actionLoading !== null}
            className="px-3 py-2 text-sm font-medium rounded border transition-colors bg-red-500 text-white border-red-500 hover:bg-red-600 disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:disabled:border-gray-600"
          >
            {actionLoading === "REMOVE" ? "Removing..." : "Remove"}
          </button>

          <button onClick={() => handleAction("TRIGGER_LOADING")} disabled={actionLoading !== null} className={`px-3 py-2 text-sm font-medium rounded border transition-colors disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:disabled:border-gray-600 ${isArtificialLoading ? "bg-gray-500 text-white border-gray-500 hover:bg-gray-600" : "bg-purple-500 text-white border-purple-500 hover:bg-purple-600"}`}>
            {actionLoading === "TRIGGER_LOADING" ? "Triggering..." : isArtificialLoading ? "Cancel Loading" : "Trigger Loading"}
          </button>

          <button onClick={() => handleAction("TRIGGER_ERROR")} disabled={actionLoading !== null} className={`px-3 py-2 text-sm font-medium rounded border transition-colors disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:disabled:border-gray-600 ${isArtificialError ? "bg-gray-500 text-white border-gray-500 hover:bg-gray-600" : "bg-orange-500 text-white border-orange-500 hover:bg-orange-600"}`}>
            {actionLoading === "TRIGGER_ERROR" ? "Triggering..." : isArtificialError ? "Cancel Error" : "Trigger Error"}
          </button>
        </div>
      </div>

      {/* Data Explorer Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
        <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">Data Explorer</h4>
        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
          {selectedQuery.state.data !== undefined && selectedQuery.state.data !== null ? (
            <JsonView
              src={selectedQuery.state.data}
              collapsed={2}
              displayDataTypes={false}
              displayObjectSize={true}
              enableClipboard={true}
              theme={isDarkMode ? "monokai" : "rjv-default"}
              style={{
                fontSize: "12px",
                fontFamily: "monospace",
                backgroundColor: "transparent",
              }}
            />
          ) : selectedQuery.state.error ? (
            <div className="text-red-600 dark:text-red-400 text-sm">
              <div className="font-medium mb-2">Error occurred:</div>
              <JsonView
                src={selectedQuery.state.error}
                collapsed={1}
                displayDataTypes={false}
                displayObjectSize={true}
                enableClipboard={true}
                theme={isDarkMode ? "monokai" : "rjv-default"}
                style={{
                  fontSize: "12px",
                  fontFamily: "monospace",
                  backgroundColor: "transparent",
                }}
              />
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-sm italic">No data available</div>
          )}
        </div>
      </div>

      {/* Query Explorer Section */}
      <div className="p-4 bg-white dark:bg-gray-800">
        <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">Query Explorer</h4>
        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
          <JsonView
            src={{
              queryKey: selectedQuery.queryKey,
              state: {
                status: selectedQuery.state.status,
                isFetching: selectedQuery.state.isFetching,
                isPending: selectedQuery.state.isPending,
                isLoading: selectedQuery.state.isLoading,
                isStale: selectedQuery.state.isStale,
                dataUpdatedAt: selectedQuery.state.dataUpdatedAt,
                errorUpdatedAt: selectedQuery.state.errorUpdatedAt,
                fetchStatus: selectedQuery.state.fetchStatus,
              },
              isActive: selectedQuery.isActive,
              observersCount: selectedQuery.observersCount,
              meta: selectedQuery.meta,
            }}
            collapsed={1}
            displayDataTypes={true}
            displayObjectSize={true}
            enableClipboard={true}
            theme={isDarkMode ? "monokai" : "rjv-default"}
            style={{
              fontSize: "12px",
              fontFamily: "monospace",
              backgroundColor: "transparent",
            }}
          />
        </div>
      </div>
    </div>
  );
}
