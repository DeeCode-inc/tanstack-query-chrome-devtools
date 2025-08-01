import { useState } from "react";
import { useDetailsAnimation } from "../../hooks/useDetailsAnimation";
import type { QueryData } from "../../types/query";
import type { QueryAction } from "../../types/messages";
import { DataExplorer } from "../common/DataExplorer";
import { QueryActions } from "./QueryActions";
import { QueryExplorer } from "./QueryExplorer";
import { QueryHeader } from "./QueryHeader";

interface QueryDetailsProps {
  selectedQuery: QueryData | null;
  onAction: (
    action: QueryAction["type"],
    queryHash: string,
    newValue?: unknown,
  ) => void;
  artificialStates: Map<string, "loading" | "error">;
}

export function QueryDetails({
  selectedQuery,
  onAction,
  artificialStates,
}: QueryDetailsProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { animationClass } = useDetailsAnimation({
    selectedItem: selectedQuery,
    getItemKey: (query: QueryData) => JSON.stringify(query.queryKey),
  });

  const handleDataEdit = (newData: unknown) => {
    if (selectedQuery) {
      // Call action with new data from edit
      onAction("SET_QUERY_DATA", selectedQuery.queryHash, newData);
    }
  };

  if (!selectedQuery) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center enter-animation-scale">
          <p>Select a query from the list to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full overflow-y-auto ${animationClass}`}>
      <QueryHeader selectedQuery={selectedQuery} />

      <QueryActions
        selectedQuery={selectedQuery}
        onAction={onAction}
        actionLoading={actionLoading}
        setActionLoading={setActionLoading}
        artificialStates={artificialStates}
      />

      <DataExplorer
        data={selectedQuery.state.data}
        error={selectedQuery.state.error}
        title="Data Explorer"
        emptyMessage="No data available"
        onEdit={handleDataEdit}
      />

      <QueryExplorer selectedQuery={selectedQuery} />
    </div>
  );
}
