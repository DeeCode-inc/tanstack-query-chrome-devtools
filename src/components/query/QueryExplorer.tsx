import JsonView from "@microlink/react-json-view";
import type { QueryData } from "../../types/query";

interface QueryExplorerProps {
  selectedQuery: QueryData;
  isDarkMode: boolean;
}

export function QueryExplorer({
  selectedQuery,
  isDarkMode,
}: QueryExplorerProps) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800">
      <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">
        Query Explorer
      </h4>
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
  );
}
