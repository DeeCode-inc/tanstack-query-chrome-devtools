// Import our extracted components
import { ActionFeedback } from "./components/status/ActionFeedback";
import { SearchBar } from "./components/layout/SearchBar";
import { ToggleGroup } from "./components/layout/ToggleGroup";
import { QueryListItem } from "./components/query/QueryListItem";
import { QueryDetails } from "./components/query/QueryDetails";
import { MutationListItem } from "./components/mutation/MutationListItem";
import { MutationDetails } from "./components/mutation/MutationDetails";

// Import our custom hooks
import { useConnection } from "./hooks/useConnection";
import { useUIState } from "./hooks/useUIState";
import { useViewState } from "./hooks/useViewState";



function App() {
  // Use our custom hooks
  const { tanStackQueryDetected, queries, mutations, artificialStates, sendMessage } = useConnection();
  const { isDarkMode, actionFeedback, handleQueryAction, setActionFeedback } = useUIState(sendMessage);
  const { currentView, searchTerm, selectedQueryIndex, selectedMutationIndex, setSearchTerm, setSelectedQueryIndex, setSelectedMutationIndex, handleViewChange } = useViewState();

  return (
    <div className="h-screen flex flex-col font-sans text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      <header className="p-5 pb-0 flex-shrink-0">
        <h1 className="text-lg font-semibold mb-5">🏠 TanStack Query DevTools</h1>
      </header>

      <main className="flex-1 px-5 flex flex-col min-h-0">
        {/* Action Feedback Toast */}
        <ActionFeedback feedback={actionFeedback} onClose={() => setActionFeedback(null)} />

        {tanStackQueryDetected === false && (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-lg mx-auto p-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-center">
              <div className="text-4xl mb-4">🔌</div>
              <h3 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">Connect Your App</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">To use TanStack Query DevTools, add this line to your application:</p>
              <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-3 mb-4">
                <code className="text-sm font-mono text-gray-800 dark:text-gray-200">window.__TANSTACK_QUERY_CLIENT__ = queryClient</code>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Place this code where you create your QueryClient instance, typically in your app setup or main component.</p>
            </div>
          </div>
        )}

        {tanStackQueryDetected === true && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-shrink-0">
              {/* Toggle Group */}
              <ToggleGroup
                currentView={currentView}
                onViewChange={handleViewChange}
                options={[
                  { value: "queries", label: "Queries", count: queries.length },
                  { value: "mutations", label: "Mutations", count: mutations.length },
                ]}
              />

              {/* Search bar */}
              <SearchBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                placeholder={`🔍 Search ${currentView}...`}
              />
            </div>

            {/* Two-column layout - constrained height */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
              {/* Left column - List */}
              <div className="border border-gray-200 rounded bg-white dark:border-gray-600 dark:bg-gray-800 overflow-hidden flex flex-col min-h-0">
                <div className="p-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex-shrink-0">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{currentView === "queries" ? "Query List" : "Mutation List"}</h4>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
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
                        .map((query, index) => <QueryListItem key={index} query={query} index={index} isSelected={selectedQueryIndex === index} onSelect={setSelectedQueryIndex} />)
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
                      .map((mutation, index) => <MutationListItem key={index} mutation={mutation} index={index} isSelected={selectedMutationIndex === index} onSelect={setSelectedMutationIndex} />)
                  )}
                </div>
              </div>

              {/* Right column - Details */}
              <div className="border border-gray-200 rounded bg-white dark:border-gray-600 dark:bg-gray-800 overflow-hidden flex flex-col min-h-0">{currentView === "queries" ? <QueryDetails selectedQuery={selectedQueryIndex !== null ? queries[selectedQueryIndex] : null} onAction={handleQueryAction} isDarkMode={isDarkMode} artificialStates={artificialStates} /> : <MutationDetails selectedMutation={selectedMutationIndex !== null ? mutations[selectedMutationIndex] : null} isDarkMode={isDarkMode} />}</div>
            </div>
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
