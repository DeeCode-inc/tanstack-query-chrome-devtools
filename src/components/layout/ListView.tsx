import { QueryListItem } from "../query/QueryListItem";
import { MutationListItem } from "../mutation/MutationListItem";
import { SkeletonQueryItem } from "../skeleton/SkeletonQueryItem";
import { SkeletonMutationItem } from "../skeleton/SkeletonMutationItem";
import type { QueryData, MutationData, ViewType } from "../../types/query";

interface ListViewProps {
  currentView: ViewType;
  searchTerm: string;
  queries: QueryData[];
  mutations: MutationData[];
  selectedQueryIndex: number | null;
  selectedMutationIndex: number | null;
  onSelectQuery: (index: number | null) => void;
  onSelectMutation: (index: number | null) => void;
  isDarkMode: boolean;
  isLoading?: boolean;
}

export function ListView({
  currentView,
  searchTerm,
  queries,
  mutations,
  selectedQueryIndex,
  selectedMutationIndex,
  onSelectQuery,
  onSelectMutation,
  isDarkMode,
  isLoading = false,
}: ListViewProps) {
  // Show skeleton during initial loading
  if (isLoading && queries.length === 0 && mutations.length === 0) {
    const skeletonCount = 3; // Show 3 skeleton items
    return (
      <div className="card-container flex flex-col min-h-0">
        <div className="p-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex-shrink-0">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {currentView === "queries" ? "Query List" : "Mutation List"}
          </h4>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 px-1 py-1">
          <div className="space-block-4">
            {Array.from({ length: skeletonCount }).map((_, index) =>
              currentView === "queries" ? (
                <SkeletonQueryItem
                  key={`skeleton-query-${index}`}
                  isDarkMode={isDarkMode}
                  staggerIndex={index}
                />
              ) : (
                <SkeletonMutationItem
                  key={`skeleton-mutation-${index}`}
                  isDarkMode={isDarkMode}
                  staggerIndex={index}
                />
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-container flex flex-col min-h-0">
      <div className="p-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex-shrink-0">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {currentView === "queries" ? "Query List" : "Mutation List"}
        </h4>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-1 py-1">
        <div className="space-block-4">
          {currentView === "queries" ? (
            queries.length === 0 ? (
              <div className="p-5 text-center text-gray-500 dark:text-gray-400">No queries found.</div>
            ) : (
              queries
                .filter((query) => {
                  if (!searchTerm) return true;
                  const queryKeyStr = JSON.stringify(query.queryKey).toLowerCase();
                  return queryKeyStr.includes(searchTerm.toLowerCase());
                })
                .map((query, index) => (
                  <QueryListItem
                    key={index}
                    query={query}
                    index={index}
                    isSelected={selectedQueryIndex === index}
                    onSelect={onSelectQuery}
                    staggerIndex={index}
                  />
                ))
            )
          ) : mutations.length === 0 ? (
            <div className="p-5 text-center text-gray-500 dark:text-gray-400">No mutations found.</div>
          ) : (
            mutations
              .filter((mutation) => {
                if (!searchTerm) return true;
                const mutationStr = (mutation.mutationKey || `Mutation #${mutation.mutationId}`).toLowerCase();
                return mutationStr.includes(searchTerm.toLowerCase());
              })
              .map((mutation, index) => (
                <MutationListItem
                  key={index}
                  mutation={mutation}
                  index={index}
                  isSelected={selectedMutationIndex === index}
                  onSelect={onSelectMutation}
                  staggerIndex={index}
                />
              ))
          )}
        </div>
      </div>
    </div>
  );
}
