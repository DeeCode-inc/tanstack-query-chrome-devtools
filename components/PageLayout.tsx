import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useDevtoolsActions } from "@/hooks/useDevtoolsActions";
import type {
  ActiveTab,
  LayoutVariant,
  MutationEntry,
  MutationSortConfig,
  QueryEntry,
  QuerySortConfig,
} from "@/types/ui";
import {
  getMutationSearchText,
  getQuerySearchText,
} from "@/utils/entry-labels";
import {
  MUTATION_SORT_OPTIONS,
  QUERY_SORT_OPTIONS,
  sortMutations,
  sortQueries,
} from "@/utils/sorting";
import { MutationDetail } from "./MutationDetail";
import { MutationList } from "./MutationList";
import { QueryDetail } from "./QueryDetail";
import { QueryList } from "./QueryList";
import { Toolbar } from "./Toolbar";

interface PageLayoutProps {
  readonly variant: LayoutVariant;
  readonly queries: readonly QueryEntry[];
  readonly mutations: readonly MutationEntry[];
}

interface ListContentProps {
  readonly activeTab: ActiveTab;
  readonly queries: readonly QueryEntry[];
  readonly mutations: readonly MutationEntry[];
  readonly selectedQueryHash: string | null;
  readonly onSelectQuery: (queryHash: string) => void;
  readonly selectedMutationId: number | null;
  readonly onSelectMutation: (mutationId: number) => void;
}

function ListContent({
  activeTab,
  queries,
  mutations,
  selectedQueryHash,
  onSelectQuery,
  selectedMutationId,
  onSelectMutation,
}: ListContentProps) {
  const { sendRemoveAllQueries, sendClearMutationCache } = useDevtoolsActions();

  return activeTab === "queries" ? (
    <QueryList
      queries={queries}
      selectedQueryHash={selectedQueryHash}
      onSelectQuery={onSelectQuery}
      onRemoveAllQueries={sendRemoveAllQueries}
    />
  ) : (
    <MutationList
      mutations={mutations}
      selectedMutationId={selectedMutationId}
      onSelectMutation={onSelectMutation}
      onRemoveAllMutations={sendClearMutationCache}
    />
  );
}

export function PageLayout({ variant, queries, mutations }: PageLayoutProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("queries");
  const [selectedQueryHash, setSelectedQueryHash] = useState<string | null>(
    null,
  );
  const [selectedMutationId, setSelectedMutationId] = useState<number | null>(
    null,
  );
  const [querySortConfig, setQuerySortConfig] = useState<QuerySortConfig>({
    term: "status",
    direction: "asc",
  });
  const [mutationSortConfig, setMutationSortConfig] =
    useState<MutationSortConfig>({ term: "status", direction: "asc" });
  const [filterTerm, setFilterTerm] = useState("");
  const deferredFilter = useDeferredValue(filterTerm);

  const sortedQueries = useMemo(
    () => sortQueries(queries, querySortConfig),
    [queries, querySortConfig],
  );
  const sortedMutations = useMemo(
    () => sortMutations(mutations, mutationSortConfig),
    [mutations, mutationSortConfig],
  );

  // Lowercased once per filter change; labels are lowercased once per entry.
  const needle = deferredFilter.toLowerCase();

  const filteredQueries = useMemo(
    () =>
      needle
        ? sortedQueries.filter((q) => getQuerySearchText(q).includes(needle))
        : sortedQueries,
    [sortedQueries, needle],
  );

  const filteredMutations = useMemo(
    () =>
      needle
        ? sortedMutations.filter((m) =>
            getMutationSearchText(m).includes(needle),
          )
        : sortedMutations,
    [sortedMutations, needle],
  );

  const activeSortConfig =
    activeTab === "queries" ? querySortConfig : mutationSortConfig;
  const activeSortOptions =
    activeTab === "queries" ? QUERY_SORT_OPTIONS : MUTATION_SORT_OPTIONS;

  const handleSortTermChange = (value: string) => {
    if (activeTab === "queries") {
      setQuerySortConfig((prev) => ({
        ...prev,
        term: value as QuerySortConfig["term"],
      }));
    } else {
      setMutationSortConfig((prev) => ({
        ...prev,
        term: value as MutationSortConfig["term"],
      }));
    }
  };

  const handleSortDirectionToggle = () => {
    if (activeTab === "queries") {
      setQuerySortConfig((prev) => ({
        ...prev,
        direction: prev.direction === "asc" ? "desc" : "asc",
      }));
    } else {
      setMutationSortConfig((prev) => ({
        ...prev,
        direction: prev.direction === "asc" ? "desc" : "asc",
      }));
    }
  };

  const selectedQuery =
    queries.find((q) => q.queryHash === selectedQueryHash) ?? null;
  const selectedMutation =
    mutations.find((m) => m.mutationId === selectedMutationId) ?? null;

  const onClearSelection = () => setSelectedQueryHash(null);

  // Auto-clear selection when query is removed externally (via sync update)
  useEffect(() => {
    if (
      selectedQueryHash !== null &&
      !queries.some((q) => q.queryHash === selectedQueryHash)
    ) {
      // oxlint-disable-next-line react/set-state-in-effect -- clears a selection whose query left the synced cache; the popup gates its detail view on this raw state.
      setSelectedQueryHash(null);
    }
  }, [selectedQueryHash, queries]);

  // Auto-clear selection when mutation is removed externally
  useEffect(() => {
    if (
      selectedMutationId !== null &&
      !mutations.some((m) => m.mutationId === selectedMutationId)
    ) {
      // oxlint-disable-next-line react/set-state-in-effect -- same as above, for mutations.
      setSelectedMutationId(null);
    }
  }, [selectedMutationId, mutations]);

  const toolbar = (
    <Toolbar
      activeTab={activeTab}
      onTabChange={setActiveTab}
      queryCount={queries.length}
      mutationCount={mutations.length}
      filterTerm={filterTerm}
      onFilterChange={setFilterTerm}
      sortTerm={activeSortConfig.term}
      sortOptions={activeSortOptions}
      onSortTermChange={handleSortTermChange}
      sortDirection={activeSortConfig.direction}
      onSortDirectionToggle={handleSortDirectionToggle}
    />
  );

  if (variant === "popup") {
    // Popup: show detail view when a query is selected on the queries tab
    if (selectedQueryHash !== null && activeTab === "queries") {
      return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <QueryDetail
            query={selectedQuery}
            onBack={() => setSelectedQueryHash(null)}
            onClearSelection={onClearSelection}
          />
        </div>
      );
    }

    // Popup: show mutation detail view when a mutation is selected on the mutations tab
    if (selectedMutationId !== null && activeTab === "mutations") {
      return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <MutationDetail
            mutation={selectedMutation}
            onBack={() => setSelectedMutationId(null)}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {toolbar}
        <div className="flex-1 overflow-y-auto">
          <ListContent
            activeTab={activeTab}
            queries={filteredQueries}
            mutations={filteredMutations}
            selectedQueryHash={selectedQueryHash}
            onSelectQuery={setSelectedQueryHash}
            selectedMutationId={selectedMutationId}
            onSelectMutation={setSelectedMutationId}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {toolbar}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        <div className="w-full h-1/2 md:w-1/2 md:h-full overflow-y-auto border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700">
          <ListContent
            activeTab={activeTab}
            queries={filteredQueries}
            mutations={filteredMutations}
            selectedQueryHash={selectedQueryHash}
            onSelectQuery={setSelectedQueryHash}
            selectedMutationId={selectedMutationId}
            onSelectMutation={setSelectedMutationId}
          />
        </div>
        <div className="w-full h-1/2 md:w-1/2 md:h-full overflow-y-auto">
          {activeTab === "queries" ? (
            <QueryDetail
              query={selectedQuery}
              onClearSelection={onClearSelection}
            />
          ) : (
            <MutationDetail mutation={selectedMutation} />
          )}
        </div>
      </div>
    </div>
  );
}
