// Injected script - runs in the webpage context for deeper TanStack Query integration
import type { Query, Mutation, QueryState } from "@tanstack/query-core";

// Message types for communication
interface TanStackQueryEvent {
  type: "QEVENT";
  subtype: "QUERY_CLIENT_DETECTED" | "QUERY_CLIENT_NOT_FOUND" | "QUERY_STATE_UPDATE" | "QUERY_DATA_UPDATE" | "MUTATION_DATA_UPDATE";
  payload?: unknown;
}

// Action message types
interface QueryActionMessage {
  type: "QUERY_ACTION";
  action: "INVALIDATE" | "REFETCH" | "REMOVE" | "RESET" | "TRIGGER_LOADING" | "TRIGGER_ERROR" | "CANCEL_LOADING" | "CANCEL_ERROR" | "SET_QUERY_DATA";
  queryHash: string;
  newData?: unknown;
}

// Action result message
interface QueryActionResult {
  type: "QUERY_ACTION_RESULT";
  action: "INVALIDATE" | "REFETCH" | "REMOVE" | "RESET" | "TRIGGER_LOADING" | "TRIGGER_ERROR" | "CANCEL_LOADING" | "CANCEL_ERROR" | "SET_QUERY_DATA";
  queryHash: string;
  success: boolean;
  error?: string;
}

// Query data interface
interface QueryData {
  queryKey: readonly unknown[];
  queryHash: string;
  state: {
    data?: unknown;
    error?: unknown;
    status: "idle" | "pending" | "success" | "error";
    isFetching: boolean;
    isPending: boolean;
    isLoading: boolean;
    isStale: boolean;
    dataUpdatedAt: number;
    errorUpdatedAt: number;
    fetchStatus: "idle" | "fetching" | "paused";
  };
  meta?: Record<string, unknown>;
  isActive: boolean;
  observersCount: number;
}

// Mutation data interface
interface MutationData {
  mutationId: number;
  mutationKey?: string;
  state: "idle" | "pending" | "success" | "error" | "paused";
  variables?: unknown;
  context?: unknown;
  data?: unknown;
  error?: unknown;
  submittedAt: number;
  isPending: boolean;
}

// Check for TanStack Query in the application's window context
function detectTanStackQuery(): boolean {
  // Only check for __TANSTACK_QUERY_CLIENT__
  if (window.__TANSTACK_QUERY_CLIENT__) {
    return true;
  }

  return false;
}

// Get the active QueryClient
function getQueryClient() {
  return window.__TANSTACK_QUERY_CLIENT__ || null;
}

// Extract query data from QueryClient
function getQueryData(): QueryData[] {
  const queryClient = getQueryClient();
  if (!queryClient || !queryClient.getQueryCache) {
    return [];
  }

  try {
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();

    return queries.map(
      (query: Query): QueryData => ({
        queryKey: query.queryKey,
        queryHash: query.queryHash,
        state: {
          data: query.state.data,
          error: query.state.error,
          status: query.state.status,
          isFetching: query.state.fetchStatus === "fetching",
          isPending: query.state.status === "pending",
          isLoading: query.state.fetchStatus === "fetching" && query.state.status === "pending",
          isStale: query.isStale(),
          dataUpdatedAt: query.state.dataUpdatedAt,
          errorUpdatedAt: query.state.errorUpdatedAt,
          fetchStatus: query.state.fetchStatus,
        },
        meta: query.meta || {},
        isActive: query.getObserversCount() > 0,
        observersCount: query.getObserversCount(),
      })
    );
  } catch (error) {
    console.error("TanStack Query DevTools: Error collecting query data:", error);
    return [];
  }
}

// Extract mutation data from QueryClient
function getMutationData(): MutationData[] {
  const queryClient = getQueryClient();
  if (!queryClient || !queryClient.getMutationCache) {
    return [];
  }

  try {
    const mutationCache = queryClient.getMutationCache();
    const mutations = mutationCache.getAll();

    return mutations.map(
      (mutation: Mutation): MutationData => ({
        mutationId: mutation.mutationId,
        mutationKey: mutation.options.mutationKey ? JSON.stringify(mutation.options.mutationKey) : undefined,
        state: mutation.state.status,
        variables: mutation.state.variables,
        context: mutation.state.context,
        data: mutation.state.data,
        error: mutation.state.error,
        submittedAt: mutation.state.submittedAt || Date.now(),
        isPending: mutation.state.status === "pending",
      })
    );
  } catch (error) {
    console.error("TanStack Query DevTools: Error collecting mutation data:", error);
    return [];
  }
}

// Send message to content script via postMessage
function sendToContentScript(event: TanStackQueryEvent) {
  window.postMessage(
    {
      source: "tanstack-query-devtools-injected",
      ...event,
    },
    "*"
  );
}

// Send query data update
function sendQueryDataUpdate() {
  const queryData = getQueryData();
  sendToContentScript({
    type: "QEVENT",
    subtype: "QUERY_DATA_UPDATE",
    payload: queryData,
  });
}

// Send mutation data update
function sendMutationDataUpdate() {
  const mutationData = getMutationData();
  sendToContentScript({
    type: "QEVENT",
    subtype: "MUTATION_DATA_UPDATE",
    payload: mutationData,
  });
}

// Setup query cache subscription
function setupQuerySubscription() {
  const queryClient = getQueryClient();
  if (!queryClient || typeof queryClient.getQueryCache !== "function") {
    return;
  }

  try {
    const queryCache = queryClient.getQueryCache();
    if (typeof queryCache.subscribe === "function") {
      // Subscribe to cache changes
      queryCache.subscribe(() => {
        sendQueryDataUpdate();
      });

      // Send initial query data
      sendQueryDataUpdate();
    }
  } catch (error) {
    console.error("TanStack Query DevTools: Error setting up subscription:", error);
  }
}

// Setup mutation cache subscription
function setupMutationSubscription() {
  const queryClient = getQueryClient();
  if (!queryClient || typeof queryClient.getMutationCache !== "function") {
    return;
  }

  try {
    const mutationCache = queryClient.getMutationCache();
    if (typeof mutationCache.subscribe === "function") {
      // Subscribe to mutation cache changes
      mutationCache.subscribe(() => {
        sendMutationDataUpdate();
      });

      // Send initial mutation data
      sendMutationDataUpdate();
    }
  } catch (error) {
    console.error("TanStack Query DevTools: Error setting up mutation subscription:", error);
  }
}

// Enhanced detection that also sets up subscription
function performEnhancedDetection() {
  const detected = detectTanStackQuery();

  if (detected) {
    sendToContentScript({
      type: "QEVENT",
      subtype: "QUERY_CLIENT_DETECTED",
    });

    // Set up subscriptions for real-time updates
    setupQuerySubscription();
    setupMutationSubscription();
  } else {
    sendToContentScript({
      type: "QEVENT",
      subtype: "QUERY_CLIENT_NOT_FOUND",
    });
  }
}

// Query action handlers
async function handleQueryAction(action: QueryActionMessage): Promise<QueryActionResult> {
  const queryClient = getQueryClient();

  if (!queryClient) {
    return {
      type: "QUERY_ACTION_RESULT",
      action: action.action,
      queryHash: action.queryHash,
      success: false,
      error: "QueryClient not found",
    };
  }

  try {
    // Find the active query using queryHash
    const activeQuery = queryClient
      .getQueryCache()
      .getAll()
      .find((query) => query.queryHash === action.queryHash);

    if (!activeQuery) {
      return {
        type: "QUERY_ACTION_RESULT",
        action: action.action,
        queryHash: action.queryHash,
        success: false,
        error: "Query not found",
      };
    }

    switch (action.action) {
      case "INVALIDATE":
        await queryClient.invalidateQueries(activeQuery);
        break;

      case "REFETCH":
        await queryClient.refetchQueries(activeQuery);
        break;

      case "REMOVE":
        queryClient.removeQueries(activeQuery);
        break;

      case "RESET":
        queryClient.resetQueries(activeQuery);
        break;

      case "TRIGGER_LOADING": {
        // Check if already in artificial loading state by checking fetchMeta
        if (activeQuery.state.fetchMeta && "__previousQueryOptions" in activeQuery.state.fetchMeta) {
          // Cancel the loading state - restore previous state
          const previousState = activeQuery.state;
          const previousOptions = activeQuery.state.fetchMeta.__previousQueryOptions;

          activeQuery.cancel({ silent: true });
          activeQuery.setState({
            ...previousState,
            fetchStatus: "idle",
            fetchMeta: null,
          });

          if (previousOptions) {
            activeQuery.fetch(previousOptions);
          }
        } else {
          // Start artificial loading state
          const __previousQueryOptions = activeQuery.options;

          // Trigger a fetch with never-resolving promise
          activeQuery.fetch({
            ...__previousQueryOptions,
            queryFn: () => {
              return new Promise(() => {
                // Never resolve
              });
            },
            gcTime: -1,
          });

          // Force the state to pending
          activeQuery.setState({
            data: undefined,
            status: "pending",
            fetchMeta: {
              ...activeQuery.state.fetchMeta,
              __previousQueryOptions,
            } as QueryState["fetchMeta"],
          });
        }
        break;
      }

      case "TRIGGER_ERROR": {
        // Check if already in artificial error state by checking fetchMeta
        if (activeQuery.state.fetchMeta && "__previousQueryState" in activeQuery.state.fetchMeta) {
          // Cancel the error state - restore previous state
          const previousState = activeQuery.state.fetchMeta.__previousQueryState;

          if (previousState) {
            activeQuery.setState({
              ...previousState,
              fetchMeta: null,
            });
          }
        } else {
          // Start artificial error state
          // Store the current state before triggering error
          const currentState = {
            data: activeQuery.state.data,
            error: activeQuery.state.error,
            status: activeQuery.state.status,
            dataUpdatedAt: activeQuery.state.dataUpdatedAt,
            errorUpdatedAt: activeQuery.state.errorUpdatedAt,
            fetchStatus: activeQuery.state.fetchStatus,
          };

          // Trigger an error state
          queryClient
            .fetchQuery({
              queryKey: activeQuery.queryKey,
              queryFn: () => Promise.reject(new Error("Error state triggered by TanStack Query DevTools for testing purposes")),
              retry: false,
              staleTime: 0,
            })
            .catch(() => {
              // Error is expected, this is the desired behavior
              // After error is set, store the previous state in fetchMeta for restoration
              activeQuery.setState({
                ...activeQuery.state,
                fetchMeta: {
                  ...activeQuery.state.fetchMeta,
                  __previousQueryState: currentState,
                } as QueryState["fetchMeta"],
              });
            });
        }
        break;
      }

      case "SET_QUERY_DATA": {
        if (!action.newData) {
          return {
            type: "QUERY_ACTION_RESULT",
            action: action.action,
            queryHash: action.queryHash,
            success: false,
            error: "No data provided for SET_QUERY_DATA action",
          };
        }

        // Update query data using queryClient.setQueryData
        queryClient.setQueryData(activeQuery.queryKey, action.newData);
        break;
      }

      default:
        throw new Error(`Unknown action: ${action.action}`);
    }

    return {
      type: "QUERY_ACTION_RESULT",
      action: action.action,
      queryHash: action.queryHash,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("TanStack Query DevTools: Action failed:", error);

    return {
      type: "QUERY_ACTION_RESULT",
      action: action.action,
      queryHash: action.queryHash,
      success: false,
      error: errorMessage,
    };
  }
}

// Send action result to content script
function sendActionResult(result: QueryActionResult) {
  window.postMessage(
    {
      source: "tanstack-query-devtools-injected",
      ...result,
    },
    "*"
  );
}

// Listen for action messages from content script
window.addEventListener("message", async (event) => {
  // Only accept messages from same origin and our content script
  if (event.origin !== window.location.origin) return;
  if (event.data?.source !== "tanstack-query-devtools-content") return;

  if (event.data.type === "QUERY_ACTION") {
    const result = await handleQueryAction(event.data);
    sendActionResult(result);

    // Trigger query data update after action
    setTimeout(sendQueryDataUpdate, 100);
  }

  // Handle immediate update requests from DevTools
  if (event.data.type === "REQUEST_IMMEDIATE_UPDATE") {
    if (detectTanStackQuery()) {
      sendQueryDataUpdate();
      sendMutationDataUpdate();
    }
  }
});

// Check if we're in a valid context
if (typeof window !== "undefined") {
  // Mark that our injected script is present
  window.__TANSTACK_QUERY_DEVTOOLS_INJECTED__ = true;

  // Perform initial detection
  performEnhancedDetection();

  // Also check periodically in case TanStack Query is loaded dynamically
  // Continue checking until TanStack Query is found (no artificial limit)
  let detectionFound = false;
  const interval = setInterval(() => {
    if (!detectionFound && detectTanStackQuery()) {
      detectionFound = true;
      performEnhancedDetection();
      clearInterval(interval);
    }
  }, 1000);

  // Stop checking after 2 minutes to avoid infinite polling
  setTimeout(() => {
    if (!detectionFound) {
      clearInterval(interval);
    }
  }, 120000);
}
