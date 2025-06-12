// Import our extracted components
import { SearchBar } from "./components/layout/SearchBar";
import { ToggleGroup } from "./components/layout/ToggleGroup";
import { EmptyState } from "./components/layout/EmptyState";
import { ListView } from "./components/layout/ListView";
import { MainLayout } from "./components/layout/MainLayout";
import { QueryDetails } from "./components/query/QueryDetails";
import { MutationDetails } from "./components/mutation/MutationDetails";

// Import our custom hooks
import { useConnection } from "./hooks/useConnection";
import { useUIState } from "./hooks/useUIState";
import { useViewState } from "./hooks/useViewState";

function App() {
  // Use our custom hooks
  const { tanStackQueryDetected, queries, mutations, artificialStates, sendMessage } = useConnection();
  const { isDarkMode, handleQueryAction } = useUIState(sendMessage);
  const { currentView, searchTerm, selectedQueryIndex, selectedMutationIndex, queryKeyboardNavigation, mutationKeyboardNavigation, setSearchTerm, setSelectedQueryIndex, setSelectedMutationIndex, handleViewChange } = useViewState();

  return (
    <div className="h-screen flex flex-col font-sans text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      <header className="p-5 pb-0 flex-shrink-0">
        {tanStackQueryDetected === true && (
          <div className="flex items-center justify-start gap-x-5 mb-5">
            <img src="/icon-48.png" alt="TanStack Query DevTools" className="w-5 h-5" />
            <ToggleGroup
              currentView={currentView}
              onViewChange={handleViewChange}
              options={[
                { value: "queries", label: "Queries", count: queries.length },
                { value: "mutations", label: "Mutations", count: mutations.length },
              ]}
            />
            <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} placeholder={`Search ${currentView}...`} />
          </div>
        )}
      </header>

      <main className="flex-1 p-5 pt-0 flex flex-col min-h-0">
        {tanStackQueryDetected === false && <EmptyState />}

        {tanStackQueryDetected === true && (
          <div className="flex-1 flex flex-col min-h-0">
            <MainLayout listView={<ListView currentView={currentView} searchTerm={searchTerm} queries={queries} mutations={mutations} selectedQueryIndex={selectedQueryIndex} selectedMutationIndex={selectedMutationIndex} onSelectQuery={setSelectedQueryIndex} onSelectMutation={setSelectedMutationIndex} queryKeyboardNavigation={queryKeyboardNavigation} mutationKeyboardNavigation={mutationKeyboardNavigation} />} detailView={currentView === "queries" ? <QueryDetails selectedQuery={selectedQueryIndex !== null ? queries[selectedQueryIndex] : null} onAction={handleQueryAction} isDarkMode={isDarkMode} artificialStates={artificialStates} /> : <MutationDetails selectedMutation={selectedMutationIndex !== null ? mutations[selectedMutationIndex] : null} isDarkMode={isDarkMode} />} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
