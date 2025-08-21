// Import our extracted components
import { SearchBar } from "../components/layout/SearchBar";
import { ToggleGroup } from "../components/layout/ToggleGroup";
import { EmptyState } from "../components/layout/EmptyState";
import { ListView } from "../components/layout/ListView";
import { QueryDetails } from "../components/query/QueryDetails";
import { MutationDetails } from "../components/mutation/MutationDetails";

// Import our custom hooks
import { usePopupConnection } from "../hooks/usePopupConnection";
import { useUIState } from "../hooks/useUIState";
import { useViewState } from "../hooks/useViewState";

// Import popup-specific styles
import "./popup.css";

function PopupApp() {
  // Use our custom hooks
  const {
    tanStackQueryDetected,
    queries,
    mutations,
    artificialStates,
    sendMessage,
  } = usePopupConnection();
  const { handleQueryAction } = useUIState(sendMessage);
  const {
    currentView,
    searchTerm,
    selectedQueryIndex,
    selectedMutationIndex,
    queryKeyboardNavigation,
    mutationKeyboardNavigation,
    setSearchTerm,
    setSelectedQueryIndex,
    setSelectedMutationIndex,
    handleViewChange,
  } = useViewState();

  return (
    <div className="h-screen flex flex-col font-sans text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden popup-responsive popup-compact">
      <header className="p-3 pb-0 flex-shrink-0">
        {tanStackQueryDetected === true && (
          <div className="flex flex-col gap-y-2 mb-3">
            <div className="flex items-center justify-start gap-x-2">
              <img
                src="/icon-48.png"
                alt="TanStack Query DevTools"
                className="w-5 h-5"
              />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                TanStack Query DevTools
              </span>
            </div>
            <ToggleGroup
              currentView={currentView}
              onViewChange={handleViewChange}
              options={[
                { value: "queries", label: "Queries", count: queries.length },
                {
                  value: "mutations",
                  label: "Mutations",
                  count: mutations.length,
                },
              ]}
            />
          </div>
        )}
      </header>

      <main className="flex-1 p-3 pt-0 flex flex-col min-h-0">
        {tanStackQueryDetected === false && <EmptyState />}

        {tanStackQueryDetected === true && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Single column layout for popup - show list or details */}
            {selectedQueryIndex === null && selectedMutationIndex === null ? (
              <div className="flex flex-col min-h-0">
                <div className="mb-3">
                  <SearchBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    placeholder={`Search ${currentView}...`}
                  />
                </div>
                <ListView
                  currentView={currentView}
                  searchTerm={searchTerm}
                  queries={queries}
                  mutations={mutations}
                  selectedQueryIndex={selectedQueryIndex}
                  selectedMutationIndex={selectedMutationIndex}
                  onSelectQuery={setSelectedQueryIndex}
                  onSelectMutation={setSelectedMutationIndex}
                  queryKeyboardNavigation={queryKeyboardNavigation}
                  mutationKeyboardNavigation={mutationKeyboardNavigation}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mb-2">
                  <button
                    onClick={() => {
                      setSelectedQueryIndex(null);
                      setSelectedMutationIndex(null);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    ← Back to {currentView}
                  </button>
                </div>
                {currentView === "queries" ? (
                  <QueryDetails
                    selectedQuery={
                      selectedQueryIndex !== null
                        ? queries[selectedQueryIndex]
                        : null
                    }
                    onAction={handleQueryAction}
                    artificialStates={artificialStates}
                  />
                ) : (
                  <MutationDetails
                    selectedMutation={
                      selectedMutationIndex !== null
                        ? mutations[selectedMutationIndex]
                        : null
                    }
                  />
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default PopupApp;
