import type { QueryData } from "../../types/query";
import { formatQueryKeyShort } from "../../utils/formatters";

interface QueryActionsProps {
  selectedQuery: QueryData;
  onAction: (action: string, queryHash: string) => void;
  actionLoading: string | null;
  setActionLoading: (action: string | null) => void;
  artificialStates: Map<string, "loading" | "error">;
}

export function QueryActions({ selectedQuery, onAction, actionLoading, setActionLoading, artificialStates }: QueryActionsProps) {
  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      await onAction(action, selectedQuery.queryHash);
    } finally {
      setActionLoading(null);
    }
  };

  // Check artificial states for this query
  const isArtificialLoading = artificialStates.get(selectedQuery.queryHash) === "loading";
  const isArtificialError = artificialStates.get(selectedQuery.queryHash) === "error";

  // Disable all buttons when any action is loading or when artificial loading is active
  const shouldDisableButtons = actionLoading !== null || isArtificialLoading;

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
      <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">Actions</h4>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => handleAction("REFETCH")} disabled={shouldDisableButtons} className="btn btn-blue btn-animated">
          {actionLoading === "REFETCH" ? "Refreshing..." : "Refresh"}
        </button>

        <button onClick={() => handleAction("INVALIDATE")} disabled={shouldDisableButtons} className="btn btn-orange btn-animated">
          {actionLoading === "INVALIDATE" ? "Invalidating..." : "Invalidate"}
        </button>

        <button onClick={() => handleAction("RESET")} disabled={shouldDisableButtons} className="btn btn-gray btn-animated">
          {actionLoading === "RESET" ? "Resetting..." : "Reset"}
        </button>

        <button
          onClick={() => {
            if (confirm(`Are you sure you want to remove this query from cache?\n\nQuery: ${formatQueryKeyShort(selectedQuery.queryKey)}`)) {
              handleAction("REMOVE");
            }
          }}
          disabled={shouldDisableButtons}
          className="btn btn-pink btn-animated"
        >
          {actionLoading === "REMOVE" ? "Removing..." : "Remove"}
        </button>

        <button onClick={() => handleAction("TRIGGER_LOADING")} className={`btn ${isArtificialLoading ? "btn-gray" : "btn-green"} btn-animated`}>
          {actionLoading === "TRIGGER_LOADING" ? "Triggering..." : isArtificialLoading ? "Cancel Loading" : "Trigger Loading"}
        </button>

        <button onClick={() => handleAction("TRIGGER_ERROR")} disabled={shouldDisableButtons} className={`btn ${isArtificialError ? "btn-gray" : "btn-red"} btn-animated`}>
          {actionLoading === "TRIGGER_ERROR" ? "Triggering..." : isArtificialError ? "Cancel Error" : "Trigger Error"}
        </button>
      </div>
    </div>
  );
}
