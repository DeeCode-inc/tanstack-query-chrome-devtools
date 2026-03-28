import { Trash2 } from "lucide-react";
import type { QueryEntry } from "@/types/ui";
import { QUERY_STATUS_DEFINITIONS } from "@/utils/status-theme";
import { QueryListItem } from "./QueryListItem";
import { StatusSummary } from "./StatusSummary";

interface QueryListProps {
  readonly queries: readonly QueryEntry[];
  readonly selectedQueryHash: string | null;
  readonly onSelectQuery: (queryHash: string) => void;
  readonly onRemoveAllQueries?: () => void;
}

export function QueryList({ queries, selectedQueryHash, onSelectQuery, onRemoveAllQueries }: QueryListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="@container flex items-center gap-2 px-3 py-1.5 shrink-0 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="justify-between w-full flex items-center gap-2">
          <StatusSummary items={queries} getStatus={(q) => q.status} statusDefinitions={QUERY_STATUS_DEFINITIONS} />
          {onRemoveAllQueries && (
            <button
              type="button"
              title="Remove all queries"
              className={`shrink-0 cursor-pointer text-gray-400 hover:text-red-500 ${queries.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={queries.length === 0}
              onClick={onRemoveAllQueries}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {queries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No queries</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {queries.map((query) => (
            <QueryListItem
              key={query.queryHash}
              query={query}
              isSelected={query.queryHash === selectedQueryHash}
              onSelect={() => onSelectQuery(query.queryHash)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
