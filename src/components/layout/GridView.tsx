import { useState } from "react";
import { QueryGridItem } from "../query/QueryGridItem";
import { MutationGridItem } from "../mutation/MutationGridItem";
import { SkeletonQueryItem } from "../skeleton/SkeletonQueryItem";
import { SkeletonMutationItem } from "../skeleton/SkeletonMutationItem";
import type { QueryData, MutationData, ViewType } from "../../types/query";

interface GridViewProps {
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

export function GridView({ currentView, searchTerm, queries, mutations, selectedQueryIndex, selectedMutationIndex, onSelectQuery, onSelectMutation, isDarkMode, isLoading = false }: GridViewProps) {
  // State for expanded grid items
  const [expandedQueryItems, setExpandedQueryItems] = useState<number[]>([]);
  const [expandedMutationItems, setExpandedMutationItems] = useState<number[]>([]);

  // Handle query expand/collapse
  const handleToggleQueryExpand = (index: number) => {
    setExpandedQueryItems((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  };

  // Handle mutation expand/collapse
  const handleToggleMutationExpand = (index: number) => {
    setExpandedMutationItems((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  };

  // Show skeleton during initial loading
  if (isLoading && queries.length === 0 && mutations.length === 0) {
    const skeletonCount = 6; // Show more skeleton items for grid
    return (
      <div className="card-container flex flex-col min-h-0">
        <div className="p-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex-shrink-0">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{currentView === "queries" ? "Query Grid" : "Mutation Grid"}</h4>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="card-grid-container">{Array.from({ length: skeletonCount }).map((_, index) => (currentView === "queries" ? <SkeletonQueryItem key={`skeleton-query-${index}`} isDarkMode={isDarkMode} staggerIndex={index} /> : <SkeletonMutationItem key={`skeleton-mutation-${index}`} isDarkMode={isDarkMode} staggerIndex={index} />))}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-container flex flex-col min-h-0">
      <div className="p-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex-shrink-0">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{currentView === "queries" ? "Query Grid" : "Mutation Grid"}</h4>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {currentView === "queries" ? (
          queries.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">No queries found.</div>
          ) : (
            <div className="card-grid-container">
              {queries
                .filter((query) => {
                  if (!searchTerm) return true;
                  const queryKeyStr = JSON.stringify(query.queryKey).toLowerCase();
                  return queryKeyStr.includes(searchTerm.toLowerCase());
                })
                .map((query, index) => {
                  const originalIndex = queries.indexOf(query);
                  return <QueryGridItem key={`${query.queryKey}-${index}`} query={query} index={originalIndex} isSelected={selectedQueryIndex === originalIndex} onSelect={onSelectQuery} staggerIndex={index} enableCelebration={true} isExpanded={expandedQueryItems.includes(originalIndex)} onToggleExpand={handleToggleQueryExpand} />;
                })}
            </div>
          )
        ) : mutations.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">No mutations found.</div>
        ) : (
          <div className="card-grid-container">
            {mutations
              .filter((mutation) => {
                if (!searchTerm) return true;
                const mutationStr = (mutation.mutationKey || `Mutation #${mutation.mutationId}`).toLowerCase();
                return mutationStr.includes(searchTerm.toLowerCase());
              })
              .map((mutation, index) => {
                const originalIndex = mutations.indexOf(mutation);
                return <MutationGridItem key={index} mutation={mutation} index={originalIndex} isSelected={selectedMutationIndex === originalIndex} onSelect={onSelectMutation} staggerIndex={index} isExpanded={expandedMutationItems.includes(originalIndex)} onToggleExpand={handleToggleMutationExpand} />;
              })}
          </div>
        )}
      </div>
    </div>
  );
}
