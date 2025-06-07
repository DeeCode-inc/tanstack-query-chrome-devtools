import type { QueryKey } from "@tanstack/query-core";
import type { QueryData } from "../../types/query";
import { formatQueryKeyShort, getQueryKeyString } from "../../utils/formatters";

interface QueryActionsProps {
  selectedQuery: QueryData;
  onAction: (action: string, queryKey: QueryKey) => void;
  actionLoading: string | null;
  setActionLoading: (action: string | null) => void;
  artificialStates: Map<string, "loading" | "error">;
}

export function QueryActions({ selectedQuery, onAction, actionLoading, setActionLoading, artificialStates }: QueryActionsProps) {
  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      await onAction(action, selectedQuery.queryKey);
    } finally {
      setActionLoading(null);
    }
  };

  // Check artificial states for this query
  const queryKeyString = getQueryKeyString(selectedQuery.queryKey);
  const isArtificialLoading = artificialStates.get(queryKeyString) === "loading";
  const isArtificialError = artificialStates.get(queryKeyString) === "error";

  return (
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
  );
}
