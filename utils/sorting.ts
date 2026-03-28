import type {
  QueryEntry,
  MutationEntry,
  QueryDisplayStatus,
  MutationStatus,
  QuerySortConfig,
  MutationSortConfig,
  QuerySortTerm,
  MutationSortTerm,
} from "@/types/ui";

export const QUERY_STATUS_RANK: Record<QueryDisplayStatus, number> = {
  fetching: 0,
  paused: 0,
  fresh: 1,
  stale: 2,
  inactive: 3,
};

export const MUTATION_STATUS_RANK: Record<MutationStatus, number> = {
  pending: 0,
  success: 1,
  error: 2,
  idle: 3,
};

export const QUERY_SORT_OPTIONS: readonly { value: QuerySortTerm; label: string }[] = [
  { value: "status", label: "Sort by status" },
  { value: "queryHash", label: "Sort by query hash" },
  { value: "lastUpdated", label: "Sort by last updated" },
] as const;

export const MUTATION_SORT_OPTIONS: readonly { value: MutationSortTerm; label: string }[] = [
  { value: "status", label: "Sort by status" },
  { value: "lastUpdated", label: "Sort by last updated" },
] as const;

function compareQueries(a: QueryEntry, b: QueryEntry, term: QuerySortTerm): number {
  switch (term) {
    case "status": {
      const rankDiff = QUERY_STATUS_RANK[a.status] - QUERY_STATUS_RANK[b.status];
      if (rankDiff !== 0) return rankDiff;
      // Secondary: dataUpdatedAt descending (most recent first)
      // Treat 0 as "never updated" — sort to bottom in ascending
      const aTime = a.dataUpdatedAt || -Infinity;
      const bTime = b.dataUpdatedAt || -Infinity;
      const timeDiff = bTime - aTime;
      if (timeDiff !== 0) return timeDiff;
      // Tiebreaker: queryHash alphabetical
      return a.queryHash.localeCompare(b.queryHash);
    }
    case "queryHash":
      return a.queryHash.localeCompare(b.queryHash);
    case "lastUpdated": {
      const aTime = a.dataUpdatedAt || -Infinity;
      const bTime = b.dataUpdatedAt || -Infinity;
      return aTime - bTime;
    }
  }
}

function compareMutations(a: MutationEntry, b: MutationEntry, term: MutationSortTerm): number {
  switch (term) {
    case "status": {
      const rankDiff = MUTATION_STATUS_RANK[a.status] - MUTATION_STATUS_RANK[b.status];
      if (rankDiff !== 0) return rankDiff;
      // Secondary: submittedAt descending (most recent first)
      // Treat 0 as "never submitted" — sort to bottom in ascending
      const aTime = a.state.submittedAt || -Infinity;
      const bTime = b.state.submittedAt || -Infinity;
      const timeDiff = bTime - aTime;
      if (timeDiff !== 0) return timeDiff;
      // Tiebreaker: mutationId
      return a.mutationId - b.mutationId;
    }
    case "lastUpdated": {
      const aTime = a.state.submittedAt || -Infinity;
      const bTime = b.state.submittedAt || -Infinity;
      return aTime - bTime;
    }
  }
}

export function sortQueries(queries: readonly QueryEntry[], config: QuerySortConfig): QueryEntry[] {
  const direction = config.direction === "asc" ? 1 : -1;
  return Array.from(queries).sort((a, b) => direction * compareQueries(a, b, config.term));
}

export function sortMutations(mutations: readonly MutationEntry[], config: MutationSortConfig): MutationEntry[] {
  const direction = config.direction === "asc" ? 1 : -1;
  return Array.from(mutations).sort((a, b) => direction * compareMutations(a, b, config.term));
}
