import type { InteractionProps } from "@microlink/react-json-view";
import { useState } from "react";
import { useDetailsAnimation } from "../../hooks/useDetailsAnimation";
import type { QueryData } from "../../types/query";
import { DataExplorer } from "../common/DataExplorer";
import { QueryActions } from "./QueryActions";
import { QueryExplorer } from "./QueryExplorer";
import { QueryHeader } from "./QueryHeader";

interface QueryDetailsProps {
  selectedQuery: QueryData | null;
  onAction: (action: string, queryHash: string, newValue?: unknown) => void;
  isDarkMode: boolean;
  artificialStates: Map<string, "loading" | "error">;
}

export function QueryDetails({
  selectedQuery,
  onAction,
  isDarkMode,
  artificialStates,
}: QueryDetailsProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { animationClass } = useDetailsAnimation({
    selectedItem: selectedQuery,
    getItemKey: (query: QueryData) => JSON.stringify(query.queryKey),
  });

  const handleDataEdit = (edit: InteractionProps) => {
    if (selectedQuery) {
      // Call action with new data from edit
      onAction("SET_QUERY_DATA", selectedQuery.queryHash, edit.updated_src);
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
        isDarkMode={isDarkMode}
        title="Data Explorer"
        emptyMessage="No data available"
        onEdit={handleDataEdit}
      />

      <QueryExplorer selectedQuery={selectedQuery} isDarkMode={isDarkMode} />
    </div>
  );
}
