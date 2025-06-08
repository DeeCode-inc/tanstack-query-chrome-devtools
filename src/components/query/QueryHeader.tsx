import type { QueryData } from "../../types/query";
import { getQueryStatusDisplay } from "../../utils/status";
import { formatQueryKeyDetailed } from "../../utils/formatters";
import { StatusText } from "../status/StatusText";

interface QueryHeaderProps {
  selectedQuery: QueryData;
}

export function QueryHeader({ selectedQuery }: QueryHeaderProps) {
  const status = getQueryStatusDisplay(selectedQuery);
  const lastUpdated = Math.max(selectedQuery.state.dataUpdatedAt, selectedQuery.state.errorUpdatedAt);

  return (
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
          <StatusText status={status} enableCelebration={true} />
        </div>
      </div>

      {/* Observers and Last Updated */}
      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
        <div>Observers: {selectedQuery.observersCount}</div>
        <div>Last updated: {lastUpdated > 0 ? new Date(lastUpdated).toLocaleTimeString() : "Never"}</div>
      </div>
    </div>
  );
}
