import { useEffect, useDeferredValue, useMemo, useState } from "react";
import type { ActiveTab, LayoutVariant, QueryEntry, MutationEntry, QuerySortConfig, MutationSortConfig } from "@/types/ui";
import type { ActionType, PathSegment } from "@/types/messages";
import { Header } from "./Header";
import { SearchInput } from "./SearchInput";
import { QueryList } from "./QueryList";
import { MutationList } from "./MutationList";
import { QueryDetail } from "./QueryDetail";
import { MutationDetail } from "./MutationDetail";
import { SortTermDropdown } from "./SortTermDropdown";
import { SortDirectionButton } from "./SortDirectionButton";
import { sortQueries, sortMutations, QUERY_SORT_OPTIONS, MUTATION_SORT_OPTIONS } from "@/utils/sorting";
import { stringifyWithBigInt } from "@/utils/serialization";

function queryMatchesFilter(query: QueryEntry, filter: string): boolean {
  return stringifyWithBigInt(query.queryKey).toLowerCase().includes(filter.toLowerCase());
}

function mutationMatchesFilter(mutation: MutationEntry, index: number, filter: string): boolean {
  const label = mutation.mutationKey
    ? stringifyWithBigInt(mutation.mutationKey)
    : `Mutation #${String(index + 1)}`;
  return label.toLowerCase().includes(filter.toLowerCase());
}

interface PageLayoutProps {
  readonly variant: LayoutVariant;
  readonly queries: readonly QueryEntry[];
  readonly mutations: readonly MutationEntry[];
  readonly sendAction?: (action: ActionType, queryHash: string) => void;
  readonly sendSetData?: (queryHash: string, path: readonly PathSegment[], value: string | number | boolean) => void;
  readonly sendDeleteData?: (queryHash: string, path: readonly PathSegment[]) => void;
  readonly sendRemoveAllQueries?: () => void;
  readonly sendClearArray?: (queryHash: string, path: readonly PathSegment[]) => void;
  readonly sendClearMutationCache?: () => void;
}

interface ListContentProps {
  readonly activeTab: ActiveTab;
  readonly queries: readonly QueryEntry[];
  readonly mutations: readonly MutationEntry[];
  readonly selectedQueryHash: string | null;
  readonly onSelectQuery: (queryHash: string) => void;
  readonly onRemoveAllQueries?: () => void;
  readonly selectedMutationId: number | null;
  readonly onSelectMutation: (mutationId: number) => void;
  readonly onClearMutationCache?: () => void;
}

function ListContent({ activeTab, queries, mutations, selectedQueryHash, onSelectQuery, onRemoveAllQueries, selectedMutationId, onSelectMutation, onClearMutationCache }: ListContentProps) {
  return activeTab === "queries" ? (
    <QueryList queries={queries} selectedQueryHash={selectedQueryHash} onSelectQuery={onSelectQuery} onRemoveAllQueries={onRemoveAllQueries} />
  ) : (
    <MutationList mutations={mutations} selectedMutationId={selectedMutationId} onSelectMutation={onSelectMutation} onRemoveAllMutations={onClearMutationCache} />
  );
}

export function PageLayout({ variant, queries, mutations, sendAction, sendSetData, sendDeleteData, sendRemoveAllQueries, sendClearArray, sendClearMutationCache }: PageLayoutProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("queries");
  const [selectedQueryHash, setSelectedQueryHash] = useState<string | null>(null);
  const [selectedMutationId, setSelectedMutationId] = useState<number | null>(null);
  const [querySortConfig, setQuerySortConfig] = useState<QuerySortConfig>({ term: "status", direction: "asc" });
  const [mutationSortConfig, setMutationSortConfig] = useState<MutationSortConfig>({ term: "status", direction: "asc" });
  const [filterTerm, setFilterTerm] = useState("");
  const deferredFilter = useDeferredValue(filterTerm);

  const sortedQueries = useMemo(() => sortQueries(queries, querySortConfig), [queries, querySortConfig]);
  const sortedMutations = useMemo(() => sortMutations(mutations, mutationSortConfig), [mutations, mutationSortConfig]);

  const filteredQueries = useMemo(
    () => deferredFilter ? sortedQueries.filter(q => queryMatchesFilter(q, deferredFilter)) : sortedQueries,
    [sortedQueries, deferredFilter],
  );

  const filteredMutations = useMemo(
    () => {
      if (!deferredFilter) return sortedMutations;
      return sortedMutations.filter((m, i) => mutationMatchesFilter(m, i, deferredFilter));
    },
    [sortedMutations, deferredFilter],
  );

  const activeSortConfig = activeTab === "queries" ? querySortConfig : mutationSortConfig;
  const activeSortOptions = activeTab === "queries" ? QUERY_SORT_OPTIONS : MUTATION_SORT_OPTIONS;

  const handleSortTermChange = (value: string) => {
    if (activeTab === "queries") {
      setQuerySortConfig(prev => ({ ...prev, term: value as QuerySortConfig["term"] }));
    } else {
      setMutationSortConfig(prev => ({ ...prev, term: value as MutationSortConfig["term"] }));
    }
  };

  const handleSortDirectionToggle = () => {
    if (activeTab === "queries") {
      setQuerySortConfig(prev => ({ ...prev, direction: prev.direction === "asc" ? "desc" : "asc" }));
    } else {
      setMutationSortConfig(prev => ({ ...prev, direction: prev.direction === "asc" ? "desc" : "asc" }));
    }
  };

  const selectedQuery = queries.find(q => q.queryHash === selectedQueryHash) ?? null;
  const selectedMutation = mutations.find(m => m.mutationId === selectedMutationId) ?? null;

  const onClearSelection = () => setSelectedQueryHash(null);

  // Auto-clear selection when query is removed externally (via sync update)
  useEffect(() => {
    if (selectedQueryHash !== null && !queries.some(q => q.queryHash === selectedQueryHash)) {
      setSelectedQueryHash(null);
    }
  }, [selectedQueryHash, queries]);

  // Auto-clear selection when mutation is removed externally
  useEffect(() => {
    if (selectedMutationId !== null && !mutations.some(m => m.mutationId === selectedMutationId)) {
      setSelectedMutationId(null);
    }
  }, [selectedMutationId, mutations]);

  if (variant === "popup") {
    // Popup: show detail view when a query is selected on the queries tab
    if (selectedQueryHash !== null && activeTab === "queries") {
      return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <QueryDetail query={selectedQuery} onBack={() => setSelectedQueryHash(null)} activeTab={activeTab} sendAction={sendAction} sendSetData={sendSetData} sendDeleteData={sendDeleteData} sendClearArray={sendClearArray} onClearSelection={onClearSelection} />
        </div>
      );
    }

    // Popup: show mutation detail view when a mutation is selected on the mutations tab
    if (selectedMutationId !== null && activeTab === "mutations") {
      return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <MutationDetail mutation={selectedMutation} onBack={() => setSelectedMutationId(null)} />
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Header
          activeTab={activeTab}
          onTabChange={setActiveTab}
          queryCount={queries.length}
          mutationCount={mutations.length}
        />
        <div className="flex items-center gap-2 px-3 py-2">
          <SearchInput value={filterTerm} onChange={setFilterTerm} />
          <SortTermDropdown value={activeSortConfig.term} options={activeSortOptions} onChange={handleSortTermChange} />
          <SortDirectionButton direction={activeSortConfig.direction} onToggle={handleSortDirectionToggle} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <ListContent
            activeTab={activeTab}
            queries={filteredQueries}
            mutations={filteredMutations}
            selectedQueryHash={selectedQueryHash}
            onSelectQuery={setSelectedQueryHash}
            onRemoveAllQueries={sendRemoveAllQueries}
            selectedMutationId={selectedMutationId}
            onSelectMutation={setSelectedMutationId}
            onClearMutationCache={sendClearMutationCache}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        queryCount={queries.length}
        mutationCount={mutations.length}
      />
      <div className="flex items-center gap-2 px-3 py-2">
        <SearchInput value={filterTerm} onChange={setFilterTerm} />
        <SortTermDropdown value={activeSortConfig.term} options={activeSortOptions} onChange={handleSortTermChange} />
        <SortDirectionButton direction={activeSortConfig.direction} onToggle={handleSortDirectionToggle} />
      </div>
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        <div className="w-full h-1/2 md:w-1/2 md:h-full overflow-y-auto border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700">
          <ListContent
            activeTab={activeTab}
            queries={filteredQueries}
            mutations={filteredMutations}
            selectedQueryHash={selectedQueryHash}
            onSelectQuery={setSelectedQueryHash}
            onRemoveAllQueries={sendRemoveAllQueries}
            selectedMutationId={selectedMutationId}
            onSelectMutation={setSelectedMutationId}
            onClearMutationCache={sendClearMutationCache}
          />
        </div>
        <div className="w-full h-1/2 md:w-1/2 md:h-full overflow-y-auto">
          {activeTab === "queries" ? (
            <QueryDetail query={selectedQuery} activeTab={activeTab} sendAction={sendAction} sendSetData={sendSetData} sendDeleteData={sendDeleteData} sendClearArray={sendClearArray} onClearSelection={onClearSelection} />
          ) : (
            <MutationDetail mutation={selectedMutation} />
          )}
        </div>
      </div>
    </div>
  );
}
