import { useEffect } from "react";
import { QueryListItem } from "../query/QueryListItem";
import { MutationListItem } from "../mutation/MutationListItem";
import { RemoveAllQueriesButton } from "../common/RemoveAllQueriesButton";
import type { QueryData, MutationData, ViewType } from "../../types/query";
import type { useKeyboardNavigation } from "../../hooks/useKeyboardNavigation";

interface ListViewProps {
  currentView: ViewType;
  searchTerm: string;
  queries: QueryData[];
  mutations: MutationData[];
  selectedQueryIndex: number | null;
  selectedMutationIndex: number | null;
  onSelectQuery: (index: number | null) => void;
  onSelectMutation: (index: number | null) => void;
  onRemoveAllQueries?: () => void;
  // Keyboard navigation props
  queryKeyboardNavigation?: ReturnType<typeof useKeyboardNavigation>;
  mutationKeyboardNavigation?: ReturnType<typeof useKeyboardNavigation>;
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
  onRemoveAllQueries,
  queryKeyboardNavigation,
  mutationKeyboardNavigation,
}: ListViewProps) {
  // Get current keyboard navigation state
  const currentKeyboardNavigation =
    currentView === "queries"
      ? queryKeyboardNavigation
      : mutationKeyboardNavigation;
  const currentData = currentView === "queries" ? queries : mutations;

  // Filter data based on search term
  const filteredData = currentData.filter((item) => {
    if (!searchTerm) return true;
    if (currentView === "queries") {
      const query = item as QueryData;
      const queryKeyStr = JSON.stringify(query.queryKey).toLowerCase();
      return queryKeyStr.includes(searchTerm.toLowerCase());
    } else {
      const mutation = item as MutationData;
      const mutationStr = (
        mutation.mutationKey || `Mutation #${mutation.mutationId}`
      ).toLowerCase();
      return mutationStr.includes(searchTerm.toLowerCase());
    }
  });

  // Sort queries so inactive ones go to the end
  const sortedData =
    currentView === "queries"
      ? [...filteredData].sort((a, b) => {
          const aQuery = a as QueryData;
          const bQuery = b as QueryData;
          if (!aQuery.isActive && bQuery.isActive) return 1;
          if (aQuery.isActive && !bQuery.isActive) return -1;
          return 0;
        })
      : [...filteredData].sort((a, b) => {
          const aMutation = a as MutationData;
          const bMutation = b as MutationData;

          return bMutation.submittedAt - aMutation.submittedAt;
        });

  useEffect(() => {
    if (currentView === "queries" && queryKeyboardNavigation) {
      queryKeyboardNavigation.updateItemCount(sortedData.length);
    } else if (currentView === "mutations" && mutationKeyboardNavigation) {
      mutationKeyboardNavigation.updateItemCount(sortedData.length);
    }
  }, [
    currentView,
    sortedData.length,
    queryKeyboardNavigation,
    mutationKeyboardNavigation,
  ]);

  return (
    <div
      className="card-container flex flex-col min-h-0"
      onKeyDown={currentKeyboardNavigation?.handleKeyDown}
      tabIndex={0}
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {currentView === "queries" ? "Query List" : "Mutation List"}
          </h4>
          {currentView === "queries" && onRemoveAllQueries && (
            <RemoveAllQueriesButton
              disabled={queries.length === 0}
              onRemoveAll={onRemoveAllQueries}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-1">
        <div className="space-block-4">
          {currentView === "queries" ? (
            queries.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No queries found.
              </div>
            ) : (
              sortedData.map((item, index) => {
                const query = item as QueryData;
                const originalIndex = queries.indexOf(query);
                return (
                  <QueryListItem
                    key={query.queryHash}
                    query={query}
                    index={originalIndex}
                    isSelected={selectedQueryIndex === originalIndex}
                    onSelect={onSelectQuery}
                    staggerIndex={index}
                    // Keyboard navigation props
                    isFocused={queryKeyboardNavigation?.focusedIndex === index}
                    isKeyboardFocused={
                      queryKeyboardNavigation?.keyboardFocused &&
                      queryKeyboardNavigation?.focusedIndex === index
                    }
                    {...queryKeyboardNavigation?.getItemProps(index)}
                  />
                );
              })
            )
          ) : mutations.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No mutations found.
            </div>
          ) : (
            sortedData.map((item, index) => {
              const mutation = item as MutationData;
              const originalIndex = mutations.indexOf(mutation);
              return (
                <MutationListItem
                  key={index}
                  mutation={mutation}
                  index={originalIndex}
                  isSelected={selectedMutationIndex === originalIndex}
                  onSelect={onSelectMutation}
                  staggerIndex={index}
                  // Keyboard navigation props
                  isFocused={mutationKeyboardNavigation?.focusedIndex === index}
                  isKeyboardFocused={
                    mutationKeyboardNavigation?.keyboardFocused &&
                    mutationKeyboardNavigation?.focusedIndex === index
                  }
                  {...mutationKeyboardNavigation?.getItemProps(index)}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
