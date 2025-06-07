import { useState, useEffect, useRef, useCallback } from "react";
import JsonView from "@microlink/react-json-view";
import type { QueryKey } from "@tanstack/query-core";

// Import our extracted components
import { ActionFeedback } from "./components/status/ActionFeedback";
import { SearchBar } from "./components/layout/SearchBar";
import { ToggleGroup } from "./components/layout/ToggleGroup";
import { QueryListItem } from "./components/query/QueryListItem";
import { MutationListItem } from "./components/mutation/MutationListItem";

// Import our centralized types
import type { QueryData, MutationData, ViewType } from "./types/query";

// Import utility functions
import { getQueryStatusDisplay, getMutationStatusDisplay } from "./utils/status";
import { formatQueryKeyShort, formatQueryKeyDetailed, getQueryKeyString } from "./utils/formatters";


// QueryDetails component for right column
function QueryDetails({ query, onAction, isDarkMode, artificialStates }: { query: QueryData | null; onAction: (action: string, queryKey: QueryKey) => void; isDarkMode: boolean; artificialStates: Map<string, "loading" | "error"> }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    if (!query) return;

    setActionLoading(action);
    try {
      await onAction(action, query.queryKey);
    } finally {
      setActionLoading(null);
    }
  };

  if (!query) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-2xl mb-2">👈</div>
          <p>Select a query from the list to view details</p>
        </div>
      </div>
    );
  }

  const status = getQueryStatusDisplay(query);
  const lastUpdated = Math.max(query.state.dataUpdatedAt, query.state.errorUpdatedAt);

  // Check artificial states for this query
  const queryKeyString = getQueryKeyString(query.queryKey);
  const isArtificialLoading = artificialStates.get(queryKeyString) === "loading";
  const isArtificialError = artificialStates.get(queryKeyString) === "error";

  return (
    <div className="h-full overflow-y-auto">
      {/* Query Details Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Query Details</h3>

        <div className="flex items-start justify-between gap-4 mb-3">
          {/* Query key - multi-line */}
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Query:</div>
            <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-700 p-2 rounded border dark:border-gray-600 text-gray-800 dark:text-gray-200">{formatQueryKeyDetailed(query.queryKey)}</pre>
          </div>

          {/* Status badge */}
          <div className="flex-shrink-0">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status:</div>
            <div className={`px-3 py-1 rounded text-white text-sm font-medium ${status.bgColor}`}>{status.text}</div>
          </div>
        </div>

        {/* Observers and Last Updated */}
        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <div>Observers: {query.observersCount}</div>
          <div>Last updated: {lastUpdated > 0 ? new Date(lastUpdated).toLocaleTimeString() : "Never"}</div>
        </div>
      </div>

      {/* Actions Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
        <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">Actions</h4>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => handleAction("REFETCH")} disabled={actionLoading !== null} className="px-3 py-2 text-sm font-medium rounded border transition-colors bg-blue-500 text-white border-blue-500 hover:bg-blue-600 disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:disabled:border-gray-600">
            {actionLoading === "REFETCH" ? "Refreshing..." : "Refresh"}
          </button>

          <button onClick={() => handleAction("INVALIDATE")} disabled={actionLoading !== null} className="px-3 py-2 text-sm font-medium rounded border transition-colors bg-yellow-500 text-gray-900 border-yellow-500 hover:bg-yellow-600 disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:disabled:border-gray-600">
            {actionLoading === "INVALIDATE" ? "Invalidating..." : "Invalidate"}
          </button>

          <button onClick={() => handleAction("RESET")} disabled={actionLoading !== null} className="px-3 py-2 text-sm font-medium rounded border transition-colors bg-gray-500 text-white border-gray-500 hover:bg-gray-600 disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:disabled:border-gray-600">
            {actionLoading === "RESET" ? "Resetting..." : "Reset"}
          </button>

          <button
            onClick={() => {
              if (confirm(`Are you sure you want to remove this query from cache?\n\nQuery: ${formatQueryKeyShort(query.queryKey)}`)) {
                handleAction("REMOVE");
              }
            }}
            disabled={actionLoading !== null}
            className="px-3 py-2 text-sm font-medium rounded border transition-colors bg-red-500 text-white border-red-500 hover:bg-red-600 disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:disabled:border-gray-600"
          >
            {actionLoading === "REMOVE" ? "Removing..." : "Remove"}
          </button>

          <button onClick={() => handleAction("TRIGGER_LOADING")} disabled={actionLoading !== null} className={`px-3 py-2 text-sm font-medium rounded border transition-colors disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:disabled:border-gray-600 ${isArtificialLoading ? "bg-gray-500 text-white border-gray-500 hover:bg-gray-600" : "bg-purple-500 text-white border-purple-500 hover:bg-purple-600"}`}>
            {actionLoading === "TRIGGER_LOADING" ? "Triggering..." : isArtificialLoading ? "Cancel Loading" : "Trigger Loading"}
          </button>

          <button onClick={() => handleAction("TRIGGER_ERROR")} disabled={actionLoading !== null} className={`px-3 py-2 text-sm font-medium rounded border transition-colors disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:disabled:border-gray-600 ${isArtificialError ? "bg-gray-500 text-white border-gray-500 hover:bg-gray-600" : "bg-orange-500 text-white border-orange-500 hover:bg-orange-600"}`}>
            {actionLoading === "TRIGGER_ERROR" ? "Triggering..." : isArtificialError ? "Cancel Error" : "Trigger Error"}
          </button>
        </div>
      </div>

      {/* Data Explorer Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
        <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">Data Explorer</h4>
        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
          {query.state.data !== undefined && query.state.data !== null ? (
            <JsonView
              src={query.state.data}
              collapsed={2}
              displayDataTypes={false}
              displayObjectSize={true}
              enableClipboard={true}
              theme={isDarkMode ? "monokai" : "rjv-default"}
              style={{
                fontSize: "12px",
                fontFamily: "monospace",
                backgroundColor: "transparent",
              }}
            />
          ) : query.state.error ? (
            <div className="text-red-600 dark:text-red-400 text-sm">
              <div className="font-medium mb-2">Error occurred:</div>
              <JsonView
                src={query.state.error}
                collapsed={1}
                displayDataTypes={false}
                displayObjectSize={true}
                enableClipboard={true}
                theme={isDarkMode ? "monokai" : "rjv-default"}
                style={{
                  fontSize: "12px",
                  fontFamily: "monospace",
                  backgroundColor: "transparent",
                }}
              />
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-sm italic">No data available</div>
          )}
        </div>
      </div>

      {/* Query Explorer Section */}
      <div className="p-4 bg-white dark:bg-gray-800">
        <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">Query Explorer</h4>
        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
          <JsonView
            src={{
              queryKey: query.queryKey,
              state: {
                status: query.state.status,
                isFetching: query.state.isFetching,
                isPending: query.state.isPending,
                isLoading: query.state.isLoading,
                isStale: query.state.isStale,
                dataUpdatedAt: query.state.dataUpdatedAt,
                errorUpdatedAt: query.state.errorUpdatedAt,
                fetchStatus: query.state.fetchStatus,
              },
              isActive: query.isActive,
              observersCount: query.observersCount,
              meta: query.meta,
            }}
            collapsed={1}
            displayDataTypes={true}
            displayObjectSize={true}
            enableClipboard={true}
            theme={isDarkMode ? "monokai" : "rjv-default"}
            style={{
              fontSize: "12px",
              fontFamily: "monospace",
              backgroundColor: "transparent",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// MutationDetails component for right column
function MutationDetails({ mutation, isDarkMode }: { mutation: MutationData | null; isDarkMode: boolean }) {
  if (!mutation) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-2xl mb-2">👈</div>
          <p>Select a mutation from the list to view details</p>
        </div>
      </div>
    );
  }

  const status = getMutationStatusDisplay(mutation);

  return (
    <div className="h-full overflow-y-auto">
      {/* Mutation Details Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Mutation Details</h3>

        <div className="flex items-start justify-between gap-4 mb-3">
          {/* Mutation info */}
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mutation:</div>
            <div className="text-sm font-mono bg-gray-50 dark:bg-gray-700 p-2 rounded border dark:border-gray-600 text-gray-800 dark:text-gray-200">{mutation.mutationKey || `Mutation #${mutation.mutationId}`}</div>
          </div>

          {/* Status badge */}
          <div className="flex-shrink-0">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status:</div>
            <div className={`px-3 py-1 rounded text-white text-sm font-medium ${status.bgColor}`}>{status.text}</div>
          </div>
        </div>

        {/* Mutation metadata */}
        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <div>Mutation ID: {mutation.mutationId}</div>
          <div>Submitted: {new Date(mutation.submittedAt).toLocaleString()}</div>
          <div>Pending: {mutation.isPending ? "Yes" : "No"}</div>
        </div>
      </div>

      {/* Variables Section */}
      {mutation.variables !== undefined && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
          <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">Variables</h4>
          <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
            <JsonView
              src={mutation.variables ?? {}}
              collapsed={2}
              displayDataTypes={false}
              displayObjectSize={true}
              enableClipboard={true}
              theme={isDarkMode ? "monokai" : "rjv-default"}
              style={{
                fontSize: "12px",
                fontFamily: "monospace",
                backgroundColor: "transparent",
              }}
            />
          </div>
        </div>
      )}

      {/* Data Explorer Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
        <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">Data Explorer</h4>
        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
          {mutation.data !== undefined && mutation.data !== null ? (
            <JsonView
              src={mutation.data}
              collapsed={2}
              displayDataTypes={false}
              displayObjectSize={true}
              enableClipboard={true}
              theme={isDarkMode ? "monokai" : "rjv-default"}
              style={{
                fontSize: "12px",
                fontFamily: "monospace",
                backgroundColor: "transparent",
              }}
            />
          ) : mutation.error ? (
            <div className="text-red-600 dark:text-red-400 text-sm">
              <div className="font-medium mb-2">Error occurred:</div>
              <JsonView
                src={mutation.error}
                collapsed={1}
                displayDataTypes={false}
                displayObjectSize={true}
                enableClipboard={true}
                theme={isDarkMode ? "monokai" : "rjv-default"}
                style={{
                  fontSize: "12px",
                  fontFamily: "monospace",
                  backgroundColor: "transparent",
                }}
              />
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-sm italic">No data available</div>
          )}
        </div>
      </div>

      {/* Mutation Explorer Section */}
      <div className="p-4 bg-white dark:bg-gray-800">
        <h4 className="text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">Mutation Explorer</h4>
        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
          <JsonView
            src={{
              mutationId: mutation.mutationId,
              mutationKey: mutation.mutationKey || null,
              state: mutation.state,
              isPending: mutation.isPending,
              submittedAt: mutation.submittedAt,
              variables: mutation.variables || null,
              context: mutation.context || null,
              data: mutation.data || null,
              error: mutation.error || null,
            }}
            collapsed={1}
            displayDataTypes={true}
            displayObjectSize={true}
            enableClipboard={true}
            theme={isDarkMode ? "monokai" : "rjv-default"}
            style={{
              fontSize: "12px",
              fontFamily: "monospace",
              backgroundColor: "transparent",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function App() {
  const [tanStackQueryDetected, setTanStackQueryDetected] = useState<boolean | null>(null);
  const [queries, setQueries] = useState<QueryData[]>([]);
  const [mutations, setMutations] = useState<MutationData[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>("queries");
  const [searchTerm, setSearchTerm] = useState("");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [selectedQueryIndex, setSelectedQueryIndex] = useState<number | null>(null);
  const [selectedMutationIndex, setSelectedMutationIndex] = useState<number | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  // Track artificial states triggered by DevTools
  const [artificialStates, setArtificialStates] = useState<Map<string, "loading" | "error">>(new Map());

  // Connection management
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle query actions
  const handleQueryAction = useCallback(async (action: string, queryKey: QueryKey) => {
    if (!portRef.current) {
      setActionFeedback({
        message: "Not connected to background script",
        type: "error",
      });
      return;
    }

    try {
      portRef.current.postMessage({
        type: "QUERY_ACTION",
        action: action,
        queryKey: queryKey,
      });
    } catch (error) {
      console.error("Failed to send action:", error);
      setActionFeedback({
        message: `Failed to send ${action.toLowerCase()} action`,
        type: "error",
      });
    }
  }, []);

  // Clear action feedback after delay
  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => {
        setActionFeedback(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  const connectToBackground = useCallback(() => {
    try {
      const port = chrome.runtime.connect({ name: "devtools" });
      portRef.current = port;

      port.onMessage.addListener((message) => {
        if (message.type === "CONNECTION_ESTABLISHED") {
          setReconnectAttempts(0);

          // Start heartbeat
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
          }
          heartbeatIntervalRef.current = setInterval(() => {
            if (portRef.current) {
              try {
                portRef.current.postMessage({ type: "PING", timestamp: Date.now() });
              } catch (error) {
                console.warn("Failed to send ping:", error);
              }
            }
          }, 10000); // Ping every 10 seconds
        } else if (message.type === "PONG") {
          // Connection is healthy
        } else if (message.type === "INITIAL_STATE") {
          setTanStackQueryDetected(message.hasTanStackQuery);
        } else if (message.type === "QEVENT") {
          switch (message.subtype) {
            case "QUERY_CLIENT_DETECTED":
              setTanStackQueryDetected(true);
              break;
            case "QUERY_CLIENT_NOT_FOUND":
              setTanStackQueryDetected(false);
              break;
            case "QUERY_STATE_UPDATE":
              break;
            case "QUERY_DATA_UPDATE":
              if (Array.isArray(message.payload)) {
                setQueries(message.payload);
              }
              break;
            case "MUTATION_DATA_UPDATE":
              if (Array.isArray(message.payload)) {
                setMutations(message.payload);
              }
              break;
          }
        } else if (message.type === "QUERY_ACTION_RESULT") {
          // Update artificial states based on action results
          if (message.success && (message.action === "TRIGGER_LOADING" || message.action === "TRIGGER_ERROR")) {
            setArtificialStates((prev) => {
              const newStates = new Map(prev);
              const queryKeyString = JSON.stringify(message.queryKey);

              if (message.action === "TRIGGER_LOADING") {
                if (newStates.get(queryKeyString) === "loading") {
                  // Cancel loading state
                  newStates.delete(queryKeyString);
                } else {
                  // Start loading state
                  newStates.set(queryKeyString, "loading");
                }
              } else if (message.action === "TRIGGER_ERROR") {
                if (newStates.get(queryKeyString) === "error") {
                  // Cancel error state
                  newStates.delete(queryKeyString);
                } else {
                  // Start error state
                  newStates.set(queryKeyString, "error");
                }
              }

              return newStates;
            });
          }
        }
      });

      port.onDisconnect.addListener(() => {
        portRef.current = null;

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt reconnection with exponential backoff
        const attempt = reconnectAttempts + 1;
        setReconnectAttempts(attempt);

        if (attempt <= 5) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s delay

          reconnectTimeoutRef.current = setTimeout(() => {
            connectToBackground();
          }, delay);
        } else {
          console.error("Failed to reconnect after 5 attempts");
        }
      });
    } catch (error) {
      console.error("Failed to connect to background script:", error);
    }
  }, [reconnectAttempts]);

  // Detect system dark mode preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    // Set initial state
    setIsDarkMode(mediaQuery.matches);

    // Listen for changes
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    connectToBackground();

    // Cleanup function
    return () => {
      if (portRef.current) {
        portRef.current.disconnect();
        portRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [connectToBackground]);

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
                onViewChange={(view) => {
                  setCurrentView(view);
                  if (view === "queries") {
                    setSelectedMutationIndex(null);
                  } else {
                    setSelectedQueryIndex(null);
                  }
                }}
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
              <div className="border border-gray-200 rounded bg-white dark:border-gray-600 dark:bg-gray-800 overflow-hidden flex flex-col min-h-0">{currentView === "queries" ? <QueryDetails query={selectedQueryIndex !== null ? queries[selectedQueryIndex] : null} onAction={handleQueryAction} isDarkMode={isDarkMode} artificialStates={artificialStates} /> : <MutationDetails mutation={selectedMutationIndex !== null ? mutations[selectedMutationIndex] : null} isDarkMode={isDarkMode} />}</div>
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
