import { useState } from "react";
import type { QueryKey } from "@tanstack/query-core";

import type { QueryData } from "../../types/query";
import { QueryHeader } from "./QueryHeader";
import { QueryActions } from "./QueryActions";
import { QueryExplorer } from "./QueryExplorer";
import { DataExplorer } from "../common/DataExplorer";

interface QueryDetailsProps {
  selectedQuery: QueryData | null;
  onAction: (action: string, queryKey: QueryKey) => void;
  isDarkMode: boolean;
  artificialStates: Map<string, "loading" | "error">;
}

export function QueryDetails({ selectedQuery, onAction, isDarkMode, artificialStates }: QueryDetailsProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  return (
    <div className="h-full overflow-y-auto">
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
      />

      <QueryExplorer selectedQuery={selectedQuery} isDarkMode={isDarkMode} />
    </div>
  );
}
