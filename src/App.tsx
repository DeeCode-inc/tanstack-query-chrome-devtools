// Import our extracted components
import { ActionFeedback } from "./components/status/ActionFeedback";
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
  const { isDarkMode, actionFeedback, handleQueryAction, setActionFeedback } = useUIState(sendMessage);
  const { currentView, searchTerm, selectedQueryIndex, selectedMutationIndex, queryKeyboardNavigation, mutationKeyboardNavigation, setSearchTerm, setSelectedQueryIndex, setSelectedMutationIndex, handleViewChange } = useViewState();

  return (
    <div className="h-screen flex flex-col font-sans text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      <header className="p-5 pb-0 flex-shrink-0">
        <h1 className="text-lg font-semibold mb-5">🏠 TanStack Query DevTools</h1>
      </header>

      <main className="flex-1 px-5 flex flex-col min-h-0">
        {/* Action Feedback Toast */}
        <ActionFeedback feedback={actionFeedback} onClose={() => setActionFeedback(null)} />

        {tanStackQueryDetected === false && <EmptyState />}

        {tanStackQueryDetected === true && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-shrink-0">
              {/* Toggle Groups */}
              <div className="flex items-center gap-4 mb-4">
                <ToggleGroup
                  currentView={currentView}
                  onViewChange={handleViewChange}
                  options={[
                    { value: "queries", label: "Queries", count: queries.length },
                    { value: "mutations", label: "Mutations", count: mutations.length },
                  ]}
                />
              </div>

              {/* Search bar */}
              <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} placeholder={`🔍 Search ${currentView}...`} />
            </div>

            <MainLayout listView={<ListView currentView={currentView} searchTerm={searchTerm} queries={queries} mutations={mutations} selectedQueryIndex={selectedQueryIndex} selectedMutationIndex={selectedMutationIndex} onSelectQuery={setSelectedQueryIndex} onSelectMutation={setSelectedMutationIndex} queryKeyboardNavigation={queryKeyboardNavigation} mutationKeyboardNavigation={mutationKeyboardNavigation} />} detailView={currentView === "queries" ? <QueryDetails selectedQuery={selectedQueryIndex !== null ? queries[selectedQueryIndex] : null} onAction={handleQueryAction} isDarkMode={isDarkMode} artificialStates={artificialStates} /> : <MutationDetails selectedMutation={selectedMutationIndex !== null ? mutations[selectedMutationIndex] : null} isDarkMode={isDarkMode} />} />
          </div>
        )}
      </main>

      <footer className="px-5 pb-5 pt-2 flex-shrink-0">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <p>TanStack Query Chrome DevTools v0.1.0</p>
          <p>Extension context: DevTools Panel</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
