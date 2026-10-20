import type { QueryEntry } from "@/types/ui";
import { QUERY_STATUS_DEFINITIONS } from "@/utils/status-theme";
import { EntityList } from "./EntityList";
import { QueryListItem } from "./QueryListItem";

interface QueryListProps {
  readonly queries: readonly QueryEntry[];
  readonly selectedQueryHash: string | null;
  readonly onSelectQuery: (queryHash: string) => void;
  readonly onRemoveAllQueries?: () => void;
}

function getQueryHash(query: QueryEntry): string {
  return query.queryHash;
}

function getQueryStatus(query: QueryEntry): string {
  return query.status;
}

export function QueryList({
  queries,
  selectedQueryHash,
  onSelectQuery,
  onRemoveAllQueries,
}: QueryListProps) {
  return (
    <EntityList
      items={queries}
      getId={getQueryHash}
      getStatus={getQueryStatus}
      statusDefinitions={QUERY_STATUS_DEFINITIONS}
      selectedId={selectedQueryHash}
      onSelect={onSelectQuery}
      onRemoveAll={onRemoveAllQueries}
      removeAllTitle="Remove all queries"
      emptyLabel="No queries"
      renderItem={(query, isSelected, onSelect) => (
        <QueryListItem
          query={query}
          isSelected={isSelected}
          onSelect={onSelect}
        />
      )}
    />
  );
}
